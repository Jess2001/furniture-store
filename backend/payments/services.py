import logging
import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from orders.models import Order
from orders.services import commit_reservation
from orders.transitions import S, transition

from . import mpesa
from .models import Payment

logger = logging.getLogger(__name__)

# One prompt per order per minute: stops a double-click or an impatient retry
# from sending the customer several PIN prompts for the same money.
PROMPT_COOLDOWN = timedelta(seconds=60)


def initiate_mpesa_payment(order, raw_phone):
    """Create a payment attempt for an unpaid order and send the STK prompt."""
    phone = mpesa.normalize_phone(raw_phone)

    if not (
        settings.MPESA_CONSUMER_KEY
        and settings.MPESA_SHORTCODE
        and settings.MPESA_CALLBACK_BASE_URL
        and settings.MPESA_CALLBACK_TOKEN
    ):
        raise ValidationError({"payment": ["M-Pesa payments are not set up yet."]})

    now = timezone.now()
    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order.pk)
        if order.status != S.PENDING_PAYMENT:
            raise ValidationError({"order": ["This order is not waiting for payment."]})
        if order.reservation_expires_at and order.reservation_expires_at <= now:
            raise ValidationError(
                {
                    "order": [
                        "This order's reservation has expired. Please place a new order."
                    ]
                }
            )
        if Payment.objects.filter(
            order=order,
            status=Payment.Status.PENDING,
            created_at__gte=now - PROMPT_COOLDOWN,
        ).exists():
            raise ValidationError(
                {
                    "payment": [
                        "A prompt was just sent. Check your phone, or wait a minute to resend."
                    ]
                }
            )
        # an older prompt that never answered is over; the new one replaces it
        Payment.objects.filter(order=order, status=Payment.Status.PENDING).update(
            status=Payment.Status.CANCELLED,
            failure_reason="Replaced by a newer prompt.",
            completed_at=now,
        )
        charge = mpesa.whole_shillings(order.total_amount)
        if settings.MPESA_TEST_AMOUNT:
            # Testing only: charge a token amount instead of the real total.
            charge = Decimal(settings.MPESA_TEST_AMOUNT)
            logger.warning(
                "MPESA_TEST_AMOUNT is on: charging KES %s instead of %s for order %s",
                charge,
                order.total_amount,
                order.order_number,
            )
        payment = Payment.objects.create(
            order=order,
            provider=Payment.Provider.MPESA,
            method=Payment.Method.MPESA_STK,
            amount=charge,
            phone=phone,
            idempotency_key=f"mpesa-{uuid.uuid4()}",
        )

    # Talk to Safaricom outside the database lock: it can be slow.
    callback_url = (
        f"{settings.MPESA_CALLBACK_BASE_URL}/api/v1/payments/mpesa/callback/"
        f"{settings.MPESA_CALLBACK_TOKEN}/"
    )
    try:
        result = mpesa.stk_push(
            phone=phone,
            amount=payment.amount,
            reference=order.order_number,
            description="Furniture",
            callback_url=callback_url,
        )
    except mpesa.MpesaError as exc:
        Payment.objects.filter(pk=payment.pk).update(
            status=Payment.Status.FAILED,
            failure_reason=str(exc),
            completed_at=timezone.now(),
        )
        raise ValidationError({"payment": [str(exc)]})

    Payment.objects.filter(pk=payment.pk).update(
        checkout_request_id=result.get("CheckoutRequestID", "")
    )
    payment.refresh_from_db()
    return payment


@transaction.atomic
def record_mpesa_result(callback):
    """Apply Safaricom's verdict on one STK push. Safe to call twice for the same callback."""
    body = (callback.get("Body") or {}).get("stkCallback") or {}
    checkout_id = body.get("CheckoutRequestID", "")
    payment = (
        Payment.objects.select_for_update()
        .filter(provider=Payment.Provider.MPESA, checkout_request_id=checkout_id)
        .first()
        if checkout_id
        else None
    )
    if payment is None:
        logger.warning("M-Pesa callback for an unknown request: %s", checkout_id)
        return None
    if payment.status != Payment.Status.PENDING:
        return payment  # Safaricom retried, or we already handled it

    payment.raw_callback = callback
    payment.completed_at = timezone.now()

    if body.get("ResultCode") != 0:
        # 1032 means the customer dismissed the prompt; anything else is a failure
        payment.status = (
            Payment.Status.CANCELLED
            if body.get("ResultCode") == 1032
            else Payment.Status.FAILED
        )
        payment.failure_reason = body.get("ResultDesc", "")[:500]
        payment.save()
        return payment

    items = (body.get("CallbackMetadata") or {}).get("Item") or []
    details = {item.get("Name"): item.get("Value") for item in items}
    paid = Decimal(str(details.get("Amount", 0)))
    payment.provider_transaction_id = str(details.get("MpesaReceiptNumber", ""))

    if paid < payment.amount:
        payment.status = Payment.Status.FAILED
        payment.failure_reason = (
            f"Received {paid} but {payment.amount} was due "
            f"(receipt {payment.provider_transaction_id}). Needs manual review."
        )
        payment.save()
        logger.error(
            "M-Pesa underpayment on %s: %s", payment.pk, payment.failure_reason
        )
        return payment

    order = Order.objects.select_for_update().get(pk=payment.order_id)
    if order.status == S.PENDING_PAYMENT:
        payment.status = Payment.Status.SUCCESS
        commit_reservation(order)
        transition(order, S.PAID)
    else:
        # The money arrived after the order was cancelled or expired. Keep the
        # record and flag it, so someone refunds it.
        payment.status = Payment.Status.REFUND_PENDING
        payment.failure_reason = (
            f"Paid (receipt {payment.provider_transaction_id}) after the order was "
            f"{order.status}. Refund required."
        )
        logger.error("M-Pesa payment %s needs a refund", payment.pk)
    payment.save()
    return payment
