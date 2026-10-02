from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Order

S = Order.Status

ALLOWED_TRANSITIONS = {
    S.PENDING_PAYMENT: {S.PAID, S.CANCELLED},
    S.PAID: {S.PROCESSING, S.CANCELLED},
    S.PROCESSING: {S.SHIPPED, S.CANCELLED},
    S.SHIPPED: {S.OUT_FOR_DELIVERY},
    S.OUT_FOR_DELIVERY: {S.DELIVERED},
    S.DELIVERED: set(),
    S.CANCELLED: set(),
}

# What a customer may cancel on their own. Paid orders need the refund flow (Phase 6).
CUSTOMER_CANCELLABLE = {S.PENDING_PAYMENT}


def can_transition(current, new):
    return new in ALLOWED_TRANSITIONS.get(current, set())


def transition(order, new_status):
    """The only place an order's status changes. Moves stock? No: callers handle that."""
    if not can_transition(order.status, new_status):
        raise ValidationError(
            {
                "status": [
                    f"An order cannot change from {S(order.status).label} to {S(new_status).label}."
                ]
            }
        )
    order.status = new_status
    order.reservation_expires_at = (
        None  # once it leaves PENDING_PAYMENT the payment clock is over
    )
    order.cancelled_at = timezone.now() if new_status == S.CANCELLED else None
    order.save(
        update_fields=["status", "cancelled_at", "reservation_expires_at", "updated_at"]
    )
