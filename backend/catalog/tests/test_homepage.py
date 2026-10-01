import pytest
from django.db import DataError, IntegrityError, transaction
from catalog.models import Category, Product, ProductVariant

pytestmark = pytest.mark.django_db

PRODUCTS = "/api/v1/products/"
CATEGORIES = "/api/v1/categories/"


def slugs(response):
    return [item["slug"] for item in response.json()["results"]]


# ---------- categories ----------


def test_categories_follow_sort_order_then_name(api_client):
    Category.objects.create(name="Outdoor", slug="outdoor", sort_order=3)
    Category.objects.create(name="Dining", slug="dining", sort_order=2)
    Category.objects.create(name="Living Room", slug="living-room", sort_order=1)
    Category.objects.create(name="Bedroom", slug="bedroom", sort_order=2)

    response = api_client.get(CATEGORIES)

    assert [c["slug"] for c in response.json()] == [
        "living-room",
        "bedroom",
        "dining",
        "outdoor",
    ]


def test_category_product_count_only_counts_active_products(
    api_client, make_product, category
):
    make_product("Active One")
    make_product("Active Two")
    make_product("Draft", status=Product.Status.INACTIVE)
    make_product("Old", status=Product.Status.ARCHIVED)
    Category.objects.create(name="Empty", slug="empty", sort_order=5)

    counts = {c["slug"]: c["product_count"] for c in api_client.get(CATEGORIES).json()}

    assert counts == {"couches": 2, "empty": 0}


def test_category_exposes_image_url(api_client):
    Category.objects.create(
        name="Dining", slug="dining", image_url="https://x.test/dining.jpg"
    )

    assert (
        api_client.get(CATEGORIES).json()[0]["image_url"] == "https://x.test/dining.jpg"
    )


def test_categories_list_is_a_single_query(
    api_client, make_product, django_assert_num_queries
):
    make_product("Active One")

    with django_assert_num_queries(1):
        api_client.get(CATEGORIES)


# ---------- featured and badge ----------


def test_featured_filter(api_client, make_product):
    make_product("Star Sofa", is_featured=True)
    make_product("Plain Sofa")

    assert slugs(api_client.get(PRODUCTS, {"featured": "true"})) == ["star-sofa"]
    assert slugs(api_client.get(PRODUCTS, {"featured": "false"})) == ["plain-sofa"]


def test_badge_is_in_list_and_detail(api_client, make_product):
    make_product("Star Sofa", badge="Best Seller")

    assert api_client.get(PRODUCTS).json()["results"][0]["badge"] == "Best Seller"
    assert api_client.get(f"{PRODUCTS}star-sofa/").json()["badge"] == "Best Seller"


# ---------- variants on product cards ----------


def test_list_includes_compact_variants_cheapest_first(api_client, make_product):
    product = make_product("Oslo Sofa", prices=(300, 100, 200))
    ProductVariant.objects.create(
        product=product, sku="OFF-1", price=1, is_active=False
    )

    variants = api_client.get(PRODUCTS).json()["results"][0]["variants"]

    assert [v["price"] for v in variants] == ["100.00", "200.00", "300.00"]
    assert set(variants[0]) == {
        "id",
        "color",
        "color_hex",
        "price",
        "compare_at_price",
        "in_stock",
    }


def test_variant_card_data_includes_swatch_and_compare_at_price(
    api_client, make_product
):
    product = make_product("Oslo Sofa", prices=(100,))
    ProductVariant.objects.filter(product=product).update(
        color="Sand Linen", color_hex="#E3DDD1", compare_at_price=150
    )

    variant = api_client.get(PRODUCTS).json()["results"][0]["variants"][0]

    assert variant["color"] == "Sand Linen"
    assert variant["color_hex"] == "#E3DDD1"
    assert variant["compare_at_price"] == "150.00"


# ---------- constraints ----------


def test_compare_at_price_must_exceed_price(make_product):
    product = make_product("Oslo Sofa", prices=())

    ProductVariant.objects.create(
        product=product, sku="OK-1", price=100, compare_at_price=150
    )
    ProductVariant.objects.create(
        product=product, sku="OK-2", price=100
    )  # none is fine
    for bad in (100, 50):
        with pytest.raises(IntegrityError), transaction.atomic():
            ProductVariant.objects.create(
                product=product, sku=f"BAD-{bad}", price=100, compare_at_price=bad
            )


@pytest.mark.parametrize("value", ["#E3DDD1", "#e3ddd1", ""])
def test_valid_color_hex(make_product, value):
    product = make_product("Oslo Sofa", prices=())

    ProductVariant.objects.create(
        product=product, sku="HEX-1", price=10, color_hex=value
    )


@pytest.mark.parametrize("value", ["E3DDD1", "#E3DDD", "#GGGGGG", "red", "#E3DDD12"])
def test_invalid_color_hex_is_rejected(make_product, value):
    product = make_product("Oslo Sofa", prices=())
    with pytest.raises((IntegrityError, DataError)), transaction.atomic():
        ProductVariant.objects.create(
            product=product, sku="HEX-1", price=10, color_hex=value
        )
