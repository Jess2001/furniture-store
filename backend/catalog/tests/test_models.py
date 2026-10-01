import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from catalog.models import ProductImage, ProductVariant

pytestmark = pytest.mark.django_db


def test_only_one_primary_image_per_product(make_product):
    product = make_product("Oslo Sofa")
    ProductImage.objects.create(
        product=product, image_url="https://x.test/a.jpg", is_primary=True
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        ProductImage.objects.create(
            product=product, image_url="https://x.test/b.jpg", is_primary=True
        )


def test_each_product_can_have_its_own_primary_image(make_product):
    first = make_product("Oslo Sofa")
    second = make_product("Milan Sofa")

    ProductImage.objects.create(
        product=first, image_url="https://x.test/a.jpg", is_primary=True
    )
    ProductImage.objects.create(
        product=second, image_url="https://x.test/b.jpg", is_primary=True
    )


def test_product_with_variants_cannot_be_deleted(make_product):
    product = make_product("Oslo Sofa", prices=(100,))

    with pytest.raises(ProtectedError):
        product.delete()


def test_category_with_products_cannot_be_deleted(make_product, category):
    make_product("Oslo Sofa")

    with pytest.raises(ProtectedError):
        category.delete()


def test_variant_price_cannot_be_negative(make_product):
    product = make_product("Oslo Sofa", prices=())

    with pytest.raises(IntegrityError), transaction.atomic():
        ProductVariant.objects.create(product=product, sku="NEG-1", price=-1)


def test_variant_sku_must_be_unique(make_product):
    product = make_product("Oslo Sofa", prices=(100,))

    with pytest.raises(IntegrityError), transaction.atomic():
        ProductVariant.objects.create(product=product, sku="OSLO-SOFA-0", price=50)
