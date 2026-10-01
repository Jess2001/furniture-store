from django.db import transaction
from rest_framework.exceptions import ValidationError

from catalog.models import Product, ProductVariant
from catalog.stock import variant_available

from .models import Cart, CartItem

MAX_LINE_QUANTITY = 20


def get_or_create_cart(user):
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def _lock(cart):
    """Serialize changes to one cart so two simultaneous requests can't clash."""
    Cart.objects.select_for_update().get(pk=cart.pk)


def is_purchasable(variant):
    product = variant.product
    return (
        variant.is_active
        and product.status == Product.Status.ACTIVE
        and product.category.is_active
    )


def _get_purchasable_variant(variant_id):
    variant = (
        ProductVariant.objects.select_related("product__category", "inventory")
        .filter(pk=variant_id)
        .first()
    )
    if variant is None or not is_purchasable(variant):
        raise ValidationError({"variant_id": ["This item is not available."]})
    return variant


def _check_quantity(variant, quantity):
    if quantity > MAX_LINE_QUANTITY:
        raise ValidationError(
            {"quantity": [f"You can order at most {MAX_LINE_QUANTITY} of one item."]}
        )
    available = variant_available(variant)
    if available <= 0:
        raise ValidationError({"quantity": ["This item is out of stock."]})
    if quantity > available:
        raise ValidationError({"quantity": [f"Only {available} available."]})


def item_status(item):
    """Returns (problem, max_available). problem is None when the line is fine."""
    variant = item.variant
    if not is_purchasable(variant):
        return "unavailable", None
    available = variant_available(variant)
    if available <= 0:
        return "out_of_stock", None
    if item.quantity > available:
        return "insufficient_stock", available
    return None, None


@transaction.atomic
def add_item(cart, variant_id, quantity):
    _lock(cart)
    variant = _get_purchasable_variant(variant_id)
    item = CartItem.objects.filter(cart=cart, variant=variant).first()
    new_quantity = (item.quantity if item else 0) + quantity
    _check_quantity(variant, new_quantity)

    if item:
        item.quantity = new_quantity
        item.save(update_fields=["quantity", "updated_at"])
    else:
        CartItem.objects.create(cart=cart, variant=variant, quantity=new_quantity)


@transaction.atomic
def set_quantity(cart, item, quantity):
    _lock(cart)
    variant = _get_purchasable_variant(item.variant_id)
    _check_quantity(variant, quantity)
    item.quantity = quantity
    item.save(update_fields=["quantity", "updated_at"])


@transaction.atomic
def remove_item(cart, item):
    _lock(cart)
    item.delete()


@transaction.atomic
def clear_cart(cart):
    _lock(cart)
    cart.items.all().delete()
