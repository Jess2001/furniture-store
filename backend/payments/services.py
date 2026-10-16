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


def _receipt_from(raw_callback):
    """The M-Pesa receipt number inside a stored callback, if there is one."""
    stk = ((raw_callback or {}).get("Body") or {}).get("stkCallback") or {}
    items = (stk.get("CallbackMetadata") or {}).get("Item") or []
    for item in items:
        if item.get("Name") == "MpesaReceiptNumber":
            return str(item.get("Value", ""))
    return ""


def _settle_as_paid(payment, receipt):
    """Daraja has confirmed the money arrived. Call inside a transaction, with the
    payment row locked."""
    payment.provider_transaction_id = receipt
    payment.completed_at = timezone.now()
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
            f"Paid (receipt {receipt or 'unknown'}) after the order was "
            f"{order.status}. Refund required."
        )
        logger.error("M-Pesa payment %s needs a refund", payment.pk)
    payment.save()


def record_mpesa_result(callback):
    """Apply Safaricom's callback for one STK push. Safe to call twice for the same one.

    A callback that claims success is double-checked with Daraja before we trust
    it: callbacks are unsigned, so the claim alone must not release a customer's
    furniture. If Daraja cannot confirm it right now, the callback is kept and
    reconcile_pending_payments settles it later.
    """
    body = (callback.get("Body") or {}).get("stkCallback") or {}
    checkout_id = body.get("CheckoutRequestID", "")
    claims_success = body.get("ResultCode") == 0

    verdict = None
    if claims_success and checkout_id:
        try:
            verdict = mpesa.stk_query(checkout_id)  # outside any database lock
        except mpesa.MpesaError:
            logger.warning("Could not confirm callback for %s with Daraja", checkout_id)

    with transaction.atomic():
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

        if not claims_success:
            # 1032 means the customer dismissed the prompt; anything else is a failure
            payment.status = (
                Payment.Status.CANCELLED
                if body.get("ResultCode") == 1032
                else Payment.Status.FAILED
            )
            payment.failure_reason = str(body.get("ResultDesc", ""))[:500]
            payment.completed_at = timezone.now()
            payment.save()
            return payment

        details = {
            item.get("Name"): item.get("Value")
            for item in (body.get("CallbackMetadata") or {}).get("Item") or []
        }
        paid = Decimal(str(details.get("Amount", 0)))
        receipt = str(details.get("MpesaReceiptNumber", ""))

        if paid < payment.amount:
            payment.status = Payment.Status.FAILED
            payment.provider_transaction_id = receipt
            payment.completed_at = timezone.now()
            payment.failure_reason = (
                f"Received {paid} but {payment.amount} was due "
                f"(receipt {receipt}). Needs manual review."
            )
            payment.save()
            logger.error(
                "M-Pesa underpayment on %s: %s", payment.pk, payment.failure_reason
            )
            return payment

        if verdict is None or verdict.state != "success":
            # Not confirmed (yet). Keep the callback; the reconciler will settle it.
            payment.save(update_fields=["raw_callback", "updated_at"])
            logger.warning(
                "Callback says paid but Daraja says %s for %s; leaving it pending",
                verdict.state if verdict else "unreachable",
                checkout_id,
            )
            return payment

        _settle_as_paid(payment, receipt)
        return payment


def reconcile_payment(payment_id):
    """Ask Daraja about one pending payment and settle it. Returns the outcome word:
    'paid', 'refund', 'failed', 'cancelled', 'still pending' or 'error'."""
    payment = Payment.objects.get(pk=payment_id)
    try:
        verdict = mpesa.stk_query(payment.checkout_request_id)  # outside the lock
    except mpesa.MpesaError:
        return "error"

    if verdict.state == "pending":
        return "still pending"

    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment_id)
        if payment.status != Payment.Status.PENDING:
            return "still pending"  # a callback settled it while we were asking

        if verdict.state == "success":
            receipt = _receipt_from(payment.raw_callback)
            if not receipt:
                logger.warning(
                    "Payment %s is paid but has no receipt number; check the M-Pesa statement",
                    payment.pk,
                )
            _settle_as_paid(payment, receipt)
            return "paid" if payment.status == Payment.Status.SUCCESS else "refund"

        payment.status = (
            Payment.Status.CANCELLED
            if verdict.state == "cancelled"
            else Payment.Status.FAILED
        )
        payment.failure_reason = verdict.description[:500]
        payment.completed_at = timezone.now()
        payment.save()
        return verdict.state


def reconcile_pending_payments(
    *, min_age=timedelta(seconds=90), max_age=timedelta(hours=48), limit=50
):
    """Settle M-Pesa payments whose callback never arrived. Returns a count per outcome."""
    now = timezone.now()
    pending = Payment.objects.filter(
        provider=Payment.Provider.MPESA,
        status=Payment.Status.PENDING,
        created_at__lte=now - min_age,
        created_at__gte=now - max_age,
    ).order_by("created_at")

    counts = {}

    def tally(outcome):
        counts[outcome] = counts.get(outcome, 0) + 1

    # A prompt that never got a request id from Safaricom cannot be queried, and
    # nothing is coming for it: close it once it is clearly dead.
    orphans = pending.filter(
        checkout_request_id="", created_at__lte=now - timedelta(minutes=5)
    )
    closed = orphans.update(
        status=Payment.Status.FAILED,
        failure_reason="The prompt was never sent to M-Pesa.",
        completed_at=now,
    )
    if closed:
        counts["failed"] = closed

    ids = list(
        pending.exclude(checkout_request_id="").values_list("pk", flat=True)[:limit]
    )
    for payment_id in ids:
        try:
            tally(reconcile_payment(payment_id))
        except Exception:
            logger.exception("Could not reconcile payment %s", payment_id)
            tally("error")
    return counts
