import pytest

from catalog.models import Category, Product, ProductVariant
from inventory.models import Inventory

pytestmark = pytest.mark.django_db

PRODUCTS = "/api/v1/products/"
FACETS = "/api/v1/products/facets/"


def slugs(response):
    return [item["slug"] for item in response.json()["results"]]


def set_variant(product, **fields):
    ProductVariant.objects.filter(product=product).update(**fields)


def stock(variant, quantity):
    Inventory.objects.filter(variant=variant).update(quantity=quantity)


# ---------- several values in one filter ----------


def test_category_accepts_a_comma_separated_list(api_client, make_product):
    dining = Category.objects.create(name="Dining", slug="dining")
    beds = Category.objects.create(name="Beds", slug="beds")
    make_product("Sofa One")
    make_product("Table One", cat=dining)
    make_product("Bed One", cat=beds)

    assert sorted(slugs(api_client.get(PRODUCTS, {"category": "dining,beds"}))) == [
        "bed-one",
        "table-one",
    ]
    assert slugs(api_client.get(PRODUCTS, {"category": "couches"})) == [
        "sofa-one"
    ]  # single value still works
    assert slugs(api_client.get(PRODUCTS, {"category": "nope,dining"})) == ["table-one"]


def test_color_filter_takes_several_colors_as_either_or(api_client, make_product):
    for name, color in (
        ("Grey Sofa", "Grey"),
        ("Beige Sofa", "Beige"),
        ("Black Sofa", "Black"),
    ):
        set_variant(make_product(name), color=color)

    result = api_client.get(
        PRODUCTS, {"color": "grey, BEIGE"}
    )  # spaces and case do not matter

    assert sorted(slugs(result)) == ["beige-sofa", "grey-sofa"]


def test_material_filter_takes_several_materials(api_client, make_product):
    for name, material in (
        ("Teak One", "Teak"),
        ("Mvule One", "Mvule"),
        ("Linen One", "Linen"),
    ):
        set_variant(make_product(name), material=material)

    assert sorted(slugs(api_client.get(PRODUCTS, {"material": "teak,mvule"}))) == [
        "mvule-one",
        "teak-one",
    ]


def test_color_and_material_lists_must_match_the_same_variant(api_client, make_product):
    product = make_product("Oslo Sofa", prices=(100, 200))
    first, second = product.variants.order_by("sku")
    ProductVariant.objects.filter(pk=first.pk).update(color="Grey", material="Linen")
    ProductVariant.objects.filter(pk=second.pk).update(
        color="Beige", material="Leather"
    )

    assert slugs(
        api_client.get(PRODUCTS, {"color": "grey,beige", "material": "leather"})
    ) == ["oslo-sofa"]
    assert (
        slugs(api_client.get(PRODUCTS, {"color": "grey", "material": "leather"})) == []
    )


def test_empty_list_entries_are_ignored(api_client, make_product):
    set_variant(make_product("Grey Sofa"), color="Grey")

    assert slugs(api_client.get(PRODUCTS, {"color": ",,"})) == ["grey-sofa"]


# ---------- ordering ----------


def test_featured_products_can_be_ordered_first(api_client, make_product):
    make_product("Plain Old", is_featured=False)
    make_product("Star Newer", is_featured=True)
    make_product("Plain Newest", is_featured=False)

    ordered = slugs(api_client.get(PRODUCTS, {"ordering": "-is_featured,-created_at"}))

    assert ordered == ["star-newer", "plain-newest", "plain-old"]


# ---------- facets ----------


def test_facets_describe_what_the_sidebar_can_offer(api_client, make_product):
    sofa = make_product("Grey Sofa", prices=(50000, 90000))
    table = make_product("Teak Table", prices=(120000,))
    ProductVariant.objects.filter(product=sofa, sku__endswith="0").update(
        color="Grey", color_hex="#8A8D91", material="Linen"
    )
    ProductVariant.objects.filter(product=sofa, sku__endswith="1").update(
        color="Beige", color_hex="#E3DDD1", material="Linen"
    )
    set_variant(table, color="Teak", color_hex="#B07A45", material="Teak")
    stock(sofa.variants.first(), 3)

    body = api_client.get(FACETS).json()

    assert body["price"] == {"min": "50000.00", "max": "120000.00"}
    assert body["materials"] == [
        {"name": "Linen", "count": 1},
        {"name": "Teak", "count": 1},
    ]  # products, not variants
    assert {c["name"]: (c["hex"], c["count"]) for c in body["colors"]} == {
        "Grey": ("#8A8D91", 1),
        "Beige": ("#E3DDD1", 1),
        "Teak": ("#B07A45", 1),
    }
    assert body["in_stock_count"] == 1


def test_facets_ignore_anything_the_public_cannot_buy(api_client, make_product):
    visible = make_product("Visible Sofa", prices=(1000,))
    set_variant(visible, color="Grey", material="Linen")
    draft = make_product("Draft Sofa", prices=(1,), status=Product.Status.INACTIVE)
    set_variant(draft, color="Hidden", material="Secret")
    hidden_category = Category.objects.create(
        name="Hidden", slug="hidden", is_active=False
    )
    set_variant(
        make_product("Hidden Cat Sofa", prices=(999999,), cat=hidden_category),
        color="Ghost",
    )
    ProductVariant.objects.create(
        product=visible, sku="VISIBLE-OFF", price=5, color="Off", is_active=False
    )

    body = api_client.get(FACETS).json()

    assert body["price"] == {"min": "1000.00", "max": "1000.00"}
    assert [c["name"] for c in body["colors"]] == ["Grey"]
    assert [m["name"] for m in body["materials"]] == ["Linen"]


def test_facets_for_an_empty_catalog(api_client):
    body = api_client.get(FACETS).json()

    assert body == {
        "price": {"min": None, "max": None},
        "materials": [],
        "colors": [],
        "in_stock_count": 0,
    }


def test_facets_is_not_mistaken_for_a_product_slug(api_client, make_product):
    make_product("Oslo Sofa")

    response = api_client.get(FACETS)

    assert response.status_code == 200
    assert "price" in response.json()


def test_facets_is_cheap_and_needs_no_login(
    api_client, make_product, django_assert_max_num_queries
):
    for i in range(6):
        set_variant(
            make_product(f"Sofa {i}", prices=(10 + i,)), color=f"C{i}", material="Linen"
        )

    with django_assert_max_num_queries(5):
        assert api_client.get(FACETS).status_code == 200
