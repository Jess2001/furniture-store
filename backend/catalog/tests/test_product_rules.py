import pytest
from django.db import IntegrityError, transaction

from catalog.models import Product, ProductVariant

pytestmark = pytest.mark.django_db

ADD_URL = "/admin/catalog/product/add/"


def change_url(product):
    return f"/admin/catalog/product/{product.pk}/change/"


def product_data(category, status, name="Rule Sofa", slug="rule-sofa"):
    return {
        "category": str(category.pk),
        "name": name,
        "slug": slug,
        "description": "",
        "status": status,
        # empty image inline
        "images-TOTAL_FORMS": "0",
        "images-INITIAL_FORMS": "0",
        "images-MIN_NUM_FORMS": "0",
        "images-MAX_NUM_FORMS": "1000",
    }


def with_new_variant(data, sku="RULE-SOFA-1", active=True, price="100.00"):
    data.update(
        {
            "variants-TOTAL_FORMS": "1",
            "variants-INITIAL_FORMS": "0",
            "variants-MIN_NUM_FORMS": "0",
            "variants-MAX_NUM_FORMS": "1000",
            "variants-0-sku": sku,
            "variants-0-name": "",
            "variants-0-material": "",
            "variants-0-color": "",
            "variants-0-dimensions": "",
            "variants-0-price": price,
        }
    )
    if active:
        data["variants-0-is_active"] = "on"
    return data


def with_no_variants(data):
    data.update(
        {
            "variants-TOTAL_FORMS": "0",
            "variants-INITIAL_FORMS": "0",
            "variants-MIN_NUM_FORMS": "0",
            "variants-MAX_NUM_FORMS": "1000",
        }
    )
    return data


def with_existing_variant(data, variant, active):
    data.update(
        {
            "variants-TOTAL_FORMS": "1",
            "variants-INITIAL_FORMS": "1",
            "variants-MIN_NUM_FORMS": "0",
            "variants-MAX_NUM_FORMS": "1000",
            "variants-0-id": str(variant.pk),
            "variants-0-product": str(variant.product_id),
            "variants-0-sku": variant.sku,
            "variants-0-name": "",
            "variants-0-material": "",
            "variants-0-color": "",
            "variants-0-dimensions": "",
            "variants-0-price": "100.00",
        }
    )
    if active:
        data["variants-0-is_active"] = "on"
    return data


# ---------- ACTIVE needs an active variant ----------


def test_cannot_create_active_product_without_variants(superuser_client, category):
    data = with_no_variants(product_data(category, "ACTIVE"))

    response = superuser_client.post(ADD_URL, data)

    assert response.status_code == 200  # form re-rendered with an error
    assert b"needs at least one active variant" in response.content
    assert not Product.objects.filter(slug="rule-sofa").exists()


def test_cannot_create_active_product_with_only_inactive_variant(
    superuser_client, category
):
    data = with_new_variant(product_data(category, "ACTIVE"), active=False)

    response = superuser_client.post(ADD_URL, data)

    assert response.status_code == 200
    assert not Product.objects.filter(slug="rule-sofa").exists()


def test_can_create_active_product_with_an_active_variant(superuser_client, category):
    data = with_new_variant(product_data(category, "ACTIVE"))

    response = superuser_client.post(ADD_URL, data)

    assert response.status_code == 302
    assert Product.objects.get(slug="rule-sofa").status == "ACTIVE"


def test_can_create_inactive_product_without_variants(superuser_client, category):
    data = with_no_variants(product_data(category, "INACTIVE"))

    response = superuser_client.post(ADD_URL, data)

    assert response.status_code == 302


def test_cannot_deactivate_the_last_active_variant_of_an_active_product(
    superuser_client, make_product, category
):
    product = make_product("Rule Sofa", prices=(100,))
    variant = product.variants.get()
    data = with_existing_variant(
        product_data(category, "ACTIVE"), variant, active=False
    )

    response = superuser_client.post(change_url(product), data)

    assert response.status_code == 200
    variant.refresh_from_db()
    assert variant.is_active is True


def test_inactive_product_may_have_all_variants_inactive(
    superuser_client, make_product, category
):
    product = make_product("Rule Sofa", prices=(100,), status=Product.Status.INACTIVE)
    variant = product.variants.get()
    data = with_existing_variant(
        product_data(category, "INACTIVE"), variant, active=False
    )

    response = superuser_client.post(change_url(product), data)

    assert response.status_code == 302


# ---------- SKU format ----------


@pytest.mark.parametrize("sku", ["OSLO-L-GRY", "SOF001", "A-1", "TABLE-OAK-120-NAT"])
def test_valid_skus_are_accepted(make_product, sku):
    product = make_product("Rule Sofa", prices=())

    ProductVariant.objects.create(product=product, sku=sku, price=10)


@pytest.mark.parametrize(
    "sku", ["oslo-l-gry", "OSLO L GRY", "-OSLO", "OSLO-", "OSLO--GRY", "OSLO_GRY", ""]
)
def test_malformed_skus_are_rejected_by_the_database(make_product, sku):
    product = make_product("Rule Sofa", prices=())

    with pytest.raises(IntegrityError), transaction.atomic():
        ProductVariant.objects.create(product=product, sku=sku, price=10)


def test_bad_sku_in_admin_shows_a_friendly_error_not_a_crash(
    superuser_client, category
):
    data = with_new_variant(product_data(category, "INACTIVE"), sku="bad sku")

    response = superuser_client.post(ADD_URL, data)

    assert response.status_code == 200
    assert b"uppercase letters and digits" in response.content
    assert not Product.objects.filter(slug="rule-sofa").exists()
