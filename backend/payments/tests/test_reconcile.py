from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from orders import services as order_services
from orders.models import Order
from payments import mpesa, services
from payments.models import Payment
from payments.tests.test_mpesa import (  # noqa: F401  (fixtures and helpers)
    CALLBACK,
    buyer,
    callback_body,
    daraja,
    mpesa_settings,
    order,
    prompt,
    pushes,
    stock_of,
)

pytestmark = pytest.mark.django_db


def age(minutes):
    """Make the payment attempt look like it was sent this long ago."""
    Payment.objects.update(created_at=timezone.now() - timedelta(minutes=minutes))


def test_a_payment_whose_callback_never_came_is_settled_from_daraja(
    buyer, order, pushes, daraja
):
    prompt(buyer[0], order)
    age(5)

    counts = services.reconcile_pending_payments()

    assert counts == {"paid": 1}
    order.refresh_from_db()
    assert order.status == "PAID"
    assert Payment.objects.get().status == Payment.Status.SUCCESS
    assert stock_of(order) == (8, 0)


def test_the_receipt_from_a_held_back_callback_is_not_lost(
    api_client, buyer, order, pushes, daraja
):
    prompt(buyer[0], order)
    daraja.answer = mpesa.MpesaError("down")  # cannot confirm the callback right now
    api_client.post(
        CALLBACK, callback_body("ws_CO_1", receipt="QGR7KEPT99"), format="json"
    )
    daraja.answer = mpesa.StkVerdict("success", 0, "ok")  # Daraja is back
    age(5)

    services.reconcile_pending_payments()

    payment = Payment.objects.get()
    assert payment.status == Payment.Status.SUCCESS
    assert payment.provider_transaction_id == "QGR7KEPT99"


def test_a_fresh_prompt_is_left_alone(buyer, order, pushes, daraja):
    prompt(buyer[0], order)  # sent just now: the customer may still be typing

    counts = services.reconcile_pending_payments()

    assert counts == {}
    assert daraja.asked == []


def test_a_prompt_still_waiting_is_left_pending(buyer, order, pushes, daraja):
    prompt(buyer[0], order)
    age(5)
    daraja.answer = mpesa.StkVerdict("pending", None, "waiting")

    counts = services.reconcile_pending_payments()

    assert counts == {"still pending": 1}
    assert Payment.objects.get().status == Payment.Status.PENDING


@pytest.mark.parametrize(
    "state, code, status",
    [
        ("cancelled", 1032, Payment.Status.CANCELLED),
        ("failed", 2001, Payment.Status.FAILED),
    ],
)
def test_a_prompt_that_was_not_paid_is_closed_and_the_stock_stays_held(
    buyer, order, pushes, daraja, state, code, status
):
    prompt(buyer[0], order)
    age(5)
    daraja.answer = mpesa.StkVerdict(state, code, "no")

    services.reconcile_pending_payments()

    assert Payment.objects.get().status == status
    order.refresh_from_db()
    assert order.status == "PENDING_PAYMENT"
    assert stock_of(order) == (10, 2)


def test_money_found_for_a_cancelled_order_is_flagged_for_refund(
    buyer, order, pushes, daraja
):
    prompt(buyer[0], order)
    order_services.cancel_order(order)
    age(5)

    counts = services.reconcile_pending_payments()

    assert counts == {"refund": 1}
    assert Payment.objects.get().status == Payment.Status.REFUND_PENDING


def test_daraja_being_down_changes_nothing_and_is_counted(buyer, order, pushes, daraja):
    prompt(buyer[0], order)
    age(5)
    daraja.answer = mpesa.MpesaError("down")

    counts = services.reconcile_pending_payments()

    assert counts == {"error": 1}
    assert Payment.objects.get().status == Payment.Status.PENDING


def test_a_prompt_that_never_reached_safaricom_is_closed(buyer, order, pushes, daraja):
    prompt(buyer[0], order)
    Payment.objects.update(checkout_request_id="")
    age(10)

    counts = services.reconcile_pending_payments()

    assert counts == {"failed": 1}
    assert Payment.objects.get().status == Payment.Status.FAILED


def test_very_old_prompts_are_ignored(buyer, order, pushes, daraja):
    prompt(buyer[0], order)
    age(60 * 24 * 3)

    assert services.reconcile_pending_payments() == {}


def test_the_command_reports_what_it_did(buyer, order, pushes, daraja, capsys):
    prompt(buyer[0], order)
    age(5)

    call_command("reconcile_mpesa")

    assert "1 paid" in capsys.readouterr().out


# ---------- expiry and in-flight payments ----------


def expire_reservation(order):
    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timedelta(minutes=1)
    )


def test_an_order_with_a_fresh_prompt_is_not_expired_underneath_the_customer(
    buyer, order, pushes
):
    prompt(buyer[0], order)
    expire_reservation(order)

    expired, _ = order_services.expire_stale_orders()

    assert expired == 0
    order.refresh_from_db()
    assert order.status == "PENDING_PAYMENT"


def test_an_order_whose_prompt_has_gone_cold_is_expired(buyer, order, pushes):
    prompt(buyer[0], order)
    age(10)
    expire_reservation(order)

    expired, _ = order_services.expire_stale_orders()

    assert expired == 1
    order.refresh_from_db()
    assert order.status == "CANCELLED"
