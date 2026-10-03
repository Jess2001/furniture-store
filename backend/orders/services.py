from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
import logging
from cart.models import Cart, CartItem
from cart.services import is_purchasable
from inventory.models import Inventory

from .models import Order, OrderItem
from .numbers import generate_order_number
from .shipping import calculate_shipping
from .transitions import CUSTOMER_CANCELLABLE, S, transition
logger = logging.getLogger(__name__)
ORDER_NUMBER_ATTEMPTS = 5


def _line_problem(item, inventory):
    variant = item.variant
    label = f"{variant.product.name} ({variant.sku})"
    if not is_purchasable(variant):
        return f"{label}: no longer available."
    available = inventory.available_quantity if inventory else 0
    if available <= 0:
        return f"{label}: out of stock."
    if item.quantity > available:
        return f"{label}: only {available} available."
    return None


def _create_order(user, shipping, subtotal, shipping_fee):
    expires_at = timezone.now() + timedelta(minutes=settings.ORDER_RESERVATION_MINUTES)
    for _ in range(ORDER_NUMBER_ATTEMPTS):
        number = generate_order_number()
        try:
            with transaction.atomic():  # a savepoint, so a collision doesn't poison the outer transaction
                return Order.objects.create(
                    user=user,
                    order_number=number,
                    subtotal=subtotal,
                    shipping_fee=shipping_fee,
                    total_amount=subtotal + shipping_fee,
                    reservation_expires_at=expires_at,
                    **shipping,
                )
        except IntegrityError:
            if not Order.objects.filter(order_number=number).exists():
                raise  # something other than a number collision went wrong
    raise RuntimeError("Could not generate a unique order number.")


@transaction.atomic
def checkout(user, shipping, expected_subtotal=None):
    """Turn the customer's cart into an order, reserving stock, as one all-or-nothing step."""
    # 1. Lock the cart: a double-click's second request waits here, then finds it empty.
    cart = Cart.objects.select_for_update().filter(user=user).first()
    items = (
        list(
            CartItem.objects.filter(cart=cart).select_related(
                "variant__product__category"
            )
        )
        if cart
        else []
    )
    if not items:
        raise ValidationError({"cart": ["Your cart is empty."]})

    # 2. Lock the stock rows, always in the same order so two checkouts can't deadlock.
    inventories = {
        inv.variant_id: inv
        for inv in Inventory.objects.select_for_update()
        .filter(variant_id__in=[item.variant_id for item in items])
        .order_by("variant_id")
    }

    # 3. Validate every line and report all problems at once.
    problems = [
        problem
        for problem in (_line_problem(i, inventories.get(i.variant_id)) for i in items)
        if problem
    ]
    if problems:
        raise ValidationError({"cart": problems})

    # 4. Prices are re-read from the database, never trusted from the client.
    subtotal = sum((i.variant.price * i.quantity for i in items), Decimal("0.00"))
    if expected_subtotal is not None and expected_subtotal != subtotal:
        raise ValidationError(
            {
                "expected_subtotal": [
                    f"Prices have changed. The current subtotal is {subtotal:.2f}."
                ]
            }
        )
    shipping_fee = calculate_shipping(shipping, subtotal)

    # 5. Create the order with a price/name snapshot of each line.
    order = _create_order(user, shipping, subtotal, shipping_fee)
    OrderItem.objects.bulk_create(
        [
            OrderItem(
                order=order,
                product=item.variant.product,
                variant=item.variant,
                product_name=item.variant.product.name,
                variant_name=item.variant.name,
                sku=item.variant.sku,
                quantity=item.quantity,
                unit_price=item.variant.price,
                line_total=item.variant.price * item.quantity,
            )
            for item in items
        ]
    )

    # 6. Reserve the stock (the rows are locked, so this arithmetic is safe).
    for item in items:
        inventory = inventories[item.variant_id]
        inventory.reserved_quantity += item.quantity
        inventory.save(update_fields=["reserved_quantity", "updated_at"])

    # 7. Empty the cart.
    cart.items.all().delete()
    return order


def release_reservation(order):
    """Give the order's reserved stock back. Call inside a transaction."""
    items = list(order.items.filter(variant__isnull=False))
    inventories = {
        inv.variant_id: inv
        for inv in Inventory.objects.select_for_update()
        .filter(variant_id__in=[item.variant_id for item in items])
        .order_by("variant_id")
    }
    for item in items:
        inventory = inventories.get(item.variant_id)
        if inventory is None:
            continue
        # No clamping on purpose: if this ever goes below zero the database refuses it
        # and rolls the cancel back, which exposes a stock-count bug instead of hiding it.
        inventory.reserved_quantity -= item.quantity
        inventory.save(update_fields=["reserved_quantity", "updated_at"])


@transaction.atomic
def cancel_order(order):
    """Customer cancellation. Only orders still waiting for payment qualify."""
    order = Order.objects.select_for_update().get(pk=order.pk)
    if order.status == S.CANCELLED:
        raise ValidationError({"status": ["This order is already cancelled."]})
    if order.status not in CUSTOMER_CANCELLABLE:
        raise ValidationError(
            {
                "status": [
                    "This order can no longer be cancelled online. Please contact us."
                ]
            }
        )
    release_reservation(order)
    transition(order, S.CANCELLED)
    return order


def stale_orders(now):
    """Unpaid orders whose reservation window has passed."""
    return Order.objects.filter(
        status=S.PENDING_PAYMENT, reservation_expires_at__lt=now
    )


@transaction.atomic
def expire_order(order_id, now=None):
    """Cancel one stale order and free its stock. Returns False if it no longer qualifies."""
    now = now or timezone.now()
    order = Order.objects.select_for_update().get(pk=order_id)
    # Re-check under the lock: a payment may have landed since the sweep chose this order.
    if (
        order.status != S.PENDING_PAYMENT
        or order.reservation_expires_at is None
        or order.reservation_expires_at > now
    ):
        return False
    release_reservation(order)
    transition(order, S.CANCELLED)
    return True


def expire_stale_orders(now=None):
    """Sweep all stale orders, each in its own transaction. Returns (expired, failed)."""
    now = now or timezone.now()
    order_ids = list(
        stale_orders(now)
        .order_by("reservation_expires_at")
        .values_list("pk", flat=True)
    )
    expired = failed = 0
    for order_id in order_ids:
        try:
            if expire_order(order_id, now):
                expired += 1
        except Exception:
            failed += 1  # one bad order must not stop the rest
            logger.exception("Could not expire order %s", order_id)
    return expired, failed
