from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from catalog.models import Category, Product, ProductImage, ProductVariant
from inventory.models import Inventory

pytestmark = pytest.mark.django_db

CATEGORIES = "/api/v1/categories/"
PRODUCTS = "/api/v1/products/"


@pytest.fixture
def seeded(settings):
    settings.DEBUG = True
    call_command("seed_demo", stdout=StringIO())


def test_refuses_to_run_with_debug_off(settings):
    settings.DEBUG = False

    with pytest.raises(CommandError):
        call_command("seed_demo", stdout=StringIO())

    assert not Category.objects.exists()


def test_force_overrides_the_debug_guard(settings):
    settings.DEBUG = False

    call_command("seed_demo", "--force", stdout=StringIO())

    assert Category.objects.count() == 6


def test_running_twice_creates_no_duplicates(seeded, settings):
    counts = (
        Category.objects.count(),
        Product.objects.count(),
        ProductVariant.objects.count(),
        ProductImage.objects.count(),
        Inventory.objects.count(),
    )

    call_command("seed_demo", stdout=StringIO())

    assert counts == (
        Category.objects.count(),
        Product.objects.count(),
        ProductVariant.objects.count(),
        ProductImage.objects.count(),
        Inventory.objects.count(),
    )
    assert counts[:2] == (6, 13)


def test_categories_come_back_in_design_order_with_counts(seeded, api_client):
    body = api_client.get(CATEGORIES).json()

    assert [c["name"] for c in body] == [
        "Living Room",
        "Dining",
        "Bedroom",
        "Home Office",
        "Storage & Media",
        "Outdoor Living",
    ]
    assert all(c["image_url"] and c["product_count"] > 0 for c in body)


def test_four_featured_pieces_match_the_design(seeded, api_client):
    body = api_client.get(PRODUCTS, {"featured": "true"}).json()
    by_slug = {p["slug"]: p for p in body["results"]}

    assert body["count"] == 4
    mara = by_slug["mara-3-seater-linen-sofa"]
    assert mara["badge"] == "Best Seller"
    assert (
        mara["stock_status"] == "low_stock" and mara["low_stock_count"] == 3
    )  # "In Stock (3 left)"
    assert mara["variants"][0]["compare_at_price"] == "92000.00"
    assert {v["color_hex"] for v in mara["variants"]} == {
        "#E3DDD1",
        "#3A3A3C",
        "#3F5A3A",
    }
    assert by_slug["naivasha-teak-dining-table-8-seater"]["badge"] == "Solid Wood"
    assert by_slug["naivasha-teak-dining-table-8-seater"]["stock_status"] == "in_stock"
    assert by_slug["baringo-platform-bed-stands"]["badge"] == "Bespoke Option"


def test_stock_variety_is_present_for_ui_states(seeded, api_client):
    results = api_client.get(PRODUCTS).json()["results"]
    statuses = {p["slug"]: p["stock_status"] for p in results}

    assert statuses["runda-executive-chair"] == "out_of_stock"
    assert statuses["nyali-outdoor-lounge-set"] == "low_stock"
    bed = api_client.get(PRODUCTS + "baringo-platform-bed-stands/").json()
    assert {v["sku"]: v["stock_status"] for v in bed["variants"]} == {
        "BARINGO-BED-QUEEN": "low_stock",
        "BARINGO-BED-KING": "out_of_stock",
    }
    assert bed["in_stock"] is True


def test_every_product_is_active_with_an_image_and_an_active_variant(seeded):
    for product in Product.objects.all():
        assert product.status == Product.Status.ACTIVE
        assert product.images.filter(is_primary=True).count() == 1
        assert product.variants.filter(is_active=True).exists()


def test_rerunning_resets_stock_and_clears_reservations(seeded, settings):
    Inventory.objects.update(quantity=999, reserved_quantity=0)

    call_command("seed_demo", stdout=StringIO())

    assert Inventory.objects.get(variant__sku="MARA-SOFA-SAND").quantity == 1
