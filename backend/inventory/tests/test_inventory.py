import pytest
from django.db import IntegrityError, transaction
from django.db.models import F

from inventory.models import Inventory

pytestmark = pytest.mark.django_db


def test_new_variant_gets_an_empty_inventory_record(make_product):
    product = make_product("Oslo Sofa", prices=(100,))

    inventory = product.variants.get().inventory

    assert inventory.quantity == 0
    assert inventory.reserved_quantity == 0


def test_saving_an_existing_variant_does_not_create_a_second_record(make_product):
    product = make_product("Oslo Sofa", prices=(100,))
    variant = product.variants.get()

    variant.price = 150
    variant.save()

    assert Inventory.objects.filter(variant=variant).count() == 1


def test_available_quantity_is_quantity_minus_reserved(make_product):
    variant = make_product("Oslo Sofa", prices=(100,)).variants.get()
    inventory = variant.inventory
    inventory.quantity = 10
    inventory.reserved_quantity = 3
    inventory.save()

    assert inventory.available_quantity == 7


def test_stock_cannot_go_negative(make_product):
    inventory = make_product("Oslo Sofa", prices=(100,)).variants.get().inventory

    with pytest.raises(IntegrityError), transaction.atomic():
        Inventory.objects.filter(pk=inventory.pk).update(quantity=F("quantity") - 1)


def test_reserved_cannot_exceed_quantity(make_product):
    inventory = make_product("Oslo Sofa", prices=(100,)).variants.get().inventory
    inventory.quantity = 2
    inventory.save()

    with pytest.raises(IntegrityError), transaction.atomic():
        Inventory.objects.filter(pk=inventory.pk).update(reserved_quantity=3)


def test_each_variant_has_exactly_one_inventory(make_product):
    variant = make_product("Oslo Sofa", prices=(100,)).variants.get()

    with pytest.raises(IntegrityError), transaction.atomic():
        Inventory.objects.create(variant=variant)
