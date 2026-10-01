import pytest
from rest_framework.test import APIClient

from catalog.models import Category, Product, ProductImage, ProductVariant

pytestmark = pytest.mark.django_db

PRODUCTS = "/api/v1/products/"
CATEGORIES = "/api/v1/categories/"


def slugs(response):
    return [item["slug"] for item in response.json()["results"]]


# ---------- categories ----------

def test_categories_lists_only_active_without_pagination(api_client, category):
    Category.objects.create(name="Hidden", slug="hidden", is_active=False)

    response = api_client.get(CATEGORIES)

    assert response.status_code == 200
    assert [c["slug"] for c in response.json()] == ["couches"]


def test_inactive_category_detail_is_404(api_client):
    Category.objects.create(name="Hidden", slug="hidden", is_active=False)

    assert api_client.get(f"{CATEGORIES}hidden/").status_code == 404


# ---------- visibility rules ----------

def test_product_list_is_public_and_shows_only_active_products(api_client, make_product):
    make_product("Visible Sofa")
    make_product("Draft Sofa", status=Product.Status.INACTIVE)
    make_product("Old Sofa", status=Product.Status.ARCHIVED)
    hidden = Category.objects.create(name="Hidden", slug="hidden", is_active=False)
    make_product("Hidden Cat Sofa", cat=hidden)

    response = api_client.get(PRODUCTS)

    assert response.status_code == 200
    assert slugs(response) == ["visible-sofa"]


@pytest.mark.parametrize("status", [Product.Status.INACTIVE, Product.Status.ARCHIVED])
def test_non_active_product_detail_is_404(api_client, make_product, status):
    make_product("Secret Sofa", status=status)

    assert api_client.get(f"{PRODUCTS}secret-sofa/").status_code == 404


def test_expired_token_does_not_break_public_endpoints():
    client = APIClient(HTTP_AUTHORIZATION="Bearer garbage")

    assert client.get(PRODUCTS).status_code == 200


def test_catalog_is_read_only(api_client, make_product):
    make_product("Oslo Sofa")

    assert api_client.post(PRODUCTS, {}, format="json").status_code == 405
    assert api_client.delete(f"{PRODUCTS}oslo-sofa/").status_code == 405


# ---------- list payload ----------

def test_price_from_is_cheapest_active_variant(api_client, make_product):
    product = make_product("Oslo Sofa", prices=(300, 200))
    ProductVariant.objects.create(
        product=product, sku="CHEAP-BUT-OFF", price=1, is_active=False
    )

    item = api_client.get(PRODUCTS).json()["results"][0]

    assert item["price_from"] == "200.00"


def test_price_from_is_null_without_variants(api_client, make_product):
    make_product("Bare Sofa", prices=())

    assert api_client.get(PRODUCTS).json()["results"][0]["price_from"] is None


def test_primary_image_prefers_flagged_image_then_first(api_client, make_product):
    flagged = make_product("Flagged Sofa")
    ProductImage.objects.create(product=flagged, image_url="https://x.test/a.jpg")
    ProductImage.objects.create(product=flagged, image_url="https://x.test/b.jpg", is_primary=True)
    plain = make_product("Plain Sofa")
    ProductImage.objects.create(product=plain, image_url="https://x.test/c.jpg")
    make_product("Imageless Sofa")

    by_slug = {i["slug"]: i for i in api_client.get(PRODUCTS).json()["results"]}

    assert by_slug["flagged-sofa"]["primary_image"]["image_url"] == "https://x.test/b.jpg"
    assert by_slug["plain-sofa"]["primary_image"]["image_url"] == "https://x.test/c.jpg"
    assert by_slug["imageless-sofa"]["primary_image"] is None


# ---------- detail ----------

def test_detail_includes_images_and_only_active_variants(api_client, make_product):
    product = make_product("Oslo Sofa", prices=(200,))
    ProductVariant.objects.create(product=product, sku="OFF", price=50, is_active=False)
    ProductImage.objects.create(product=product, image_url="https://x.test/a.jpg")

    data = api_client.get(f"{PRODUCTS}oslo-sofa/").json()

    assert [v["sku"] for v in data["variants"]] == ["OSLO-SOFA-0"]
    assert len(data["images"]) == 1
    assert data["category"]["slug"] == "couches"


# ---------- filtering ----------

def test_filter_by_category_slug(api_client, make_product):
    tables = Category.objects.create(name="Tables", slug="tables")
    make_product("Oslo Sofa")
    make_product("Oak Table", cat=tables)

    assert slugs(api_client.get(PRODUCTS, {"category": "tables"})) == ["oak-table"]
    assert slugs(api_client.get(PRODUCTS, {"category": "nope"})) == []


def test_filter_by_price_range_uses_cheapest_variant(api_client, make_product):
    make_product("Cheap Sofa", prices=(100,))
    make_product("Mid Sofa", prices=(500, 900))
    make_product("Pricey Sofa", prices=(2000,))

    assert slugs(api_client.get(PRODUCTS, {"min_price": 400})) == ["pricey-sofa", "mid-sofa"]
    assert slugs(api_client.get(PRODUCTS, {"max_price": 150})) == ["cheap-sofa"]
    assert slugs(api_client.get(PRODUCTS, {"min_price": 400, "max_price": 600})) == ["mid-sofa"]


def test_invalid_price_filter_is_400(api_client):
    response = api_client.get(PRODUCTS, {"min_price": "abc"})

    assert response.status_code == 400
    assert "min_price" in response.json()


# ---------- search ----------

def test_search_matches_name_description_and_category(api_client, make_product):
    tables = Category.objects.create(name="Dining Tables", slug="dining-tables")
    make_product("Oak Bench", description="Solid oak")
    make_product("Milan Sofa", description="Spacious L-shaped sofa")
    make_product("Plain Slab", cat=tables)

    assert slugs(api_client.get(PRODUCTS, {"search": "bench"})) == ["oak-bench"]
    assert slugs(api_client.get(PRODUCTS, {"search": "l-shaped"})) == ["milan-sofa"]
    assert slugs(api_client.get(PRODUCTS, {"search": "dining"})) == ["plain-slab"]


# ---------- ordering ----------

def test_ordering_by_price_both_directions(api_client, make_product):
    make_product("A Sofa", prices=(300,))
    make_product("B Sofa", prices=(100,))
    make_product("C Sofa", prices=(200,))

    assert slugs(api_client.get(PRODUCTS, {"ordering": "price_from"})) == ["b-sofa", "c-sofa", "a-sofa"]
    assert slugs(api_client.get(PRODUCTS, {"ordering": "-price_from"})) == ["a-sofa", "c-sofa", "b-sofa"]


def test_ordering_ignores_fields_not_in_allowlist(api_client, make_product):
    make_product("A Sofa")

    response = api_client.get(PRODUCTS, {"ordering": "category__name"})

    assert response.status_code == 200


# ---------- pagination ----------

def test_pagination_is_stable_when_prices_tie(api_client, make_product):
    for i in range(30):
        make_product(f"Same Price {i:02d}", prices=(500,))

    first = api_client.get(PRODUCTS, {"ordering": "price_from", "page": 1})
    seen = slugs(first)
    for page in (2, 3):
        seen += slugs(api_client.get(PRODUCTS, {"ordering": "price_from", "page": page}))

    assert first.json()["count"] == 30
    assert len(first.json()["results"]) == 12
    assert first.json()["next"] is not None
    assert len(seen) == len(set(seen)) == 30


# ---------- performance ----------

def test_list_query_count_does_not_grow_with_products(api_client, make_product, django_assert_max_num_queries):
    for i in range(10):
        product = make_product(f"Sofa {i}", prices=(100 + i, 200 + i))
        ProductImage.objects.create(product=product, image_url=f"https://x.test/{i}.jpg", is_primary=True)

    with django_assert_max_num_queries(4):
        assert api_client.get(PRODUCTS).status_code == 200