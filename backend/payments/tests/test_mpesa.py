from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.models import User
from cart.services import add_item, get_or_create_cart
from conftest import PASSWORD
from inventory.models import Inventory
from orders import services as order_services
from orders.models import Order
from payments import mpesa
from payments.models import Payment

pytestmark = pytest.mark.django_db

PAY = "/api/v1/payments/mpesa/pay/"
TOKEN = "s3cret-callback-token"
CALLBACK = f"/api/v1/payments/mpesa/callback/{TOKEN}/"

SHIPPING = {
    "recipient_name": "Jane Doe",
    "recipient_phone": "+254 700 000 000",
    "address_line_1": "Ngong Road",
    "city": "Nairobi",
    "county": "Nairobi",
}


@pytest.fixture(autouse=True)
def mpesa_settings(settings):
    settings.MPESA_CONSUMER_KEY = "key"
    settings.MPESA_CONSUMER_SECRET = "secret"
    settings.MPESA_SHORTCODE = "174379"
    settings.MPESA_PASSKEY = "passkey"
    settings.MPESA_CALLBACK_BASE_URL = "https://shop.example"
    settings.MPESA_CALLBACK_TOKEN = TOKEN


@pytest.fixture
def pushes(monkeypatch):
    """Replace the call to Safaricom; record what we would have sent."""
    sent = []

    def fake_push(**kwargs):
        sent.append(kwargs)
        return {"ResponseCode": "0", "CheckoutRequestID": f"ws_CO_{len(sent)}"}

    monkeypatch.setattr(mpesa, "stk_push", fake_push)
    return sent


@pytest.fixture
def buyer(db):
    user = User.objects.create_user(
        email="buyer@example.com", password=PASSWORD, first_name="B", last_name="U"
    )
    client = APIClient()
    client.force_authenticate(user)
    return client, user


@pytest.fixture
def order(buyer, make_product):
    """An unpaid order for 2 x KES 100.50 (+ no shipping), with the stock reserved."""
    _, user = buyer
    variant = make_product("Oslo Sofa", prices=(Decimal("100.50"),)).variants.get()
    Inventory.objects.filter(variant=variant).update(quantity=10, reserved_quantity=0)
    add_item(get_or_create_cart(user), variant.id, 2)
    return order_services.checkout(user, dict(SHIPPING))


def stock_of(order):
    inventory = Inventory.objects.get(variant=order.items.get().variant)
    return inventory.quantity, inventory.reserved_quantity


def callback_body(checkout_id, code=0, amount=202, receipt="QGR7ABC123"):
    stk = {"CheckoutRequestID": checkout_id, "ResultCode": code, "ResultDesc": "x"}
    if code == 0:
        stk["CallbackMetadata"] = {
            "Item": [
                {"Name": "Amount", "Value": amount},
                {"Name": "MpesaReceiptNumber", "Value": receipt},
            ]
        }
    return {"Body": {"stkCallback": stk}}


def prompt(client, order, phone="0712 345 678"):
    return client.post(
        PAY, {"order_number": order.order_number, "phone": phone}, format="json"
    )


# ---------- phone numbers and amounts ----------


@pytest.mark.parametrize(
    "raw",
    ["0712345678", "+254 712 345 678", "254712345678", "712345678", "0112345678"],
)
def test_phone_numbers_are_normalised(raw):
    assert mpesa.normalize_phone(raw).startswith("254")
    assert len(mpesa.normalize_phone(raw)) == 12


@pytest.mark.parametrize("raw", ["", "12345", "0812345678", "+44 7700 900123"])
def test_bad_phone_numbers_are_rejected(raw):
    with pytest.raises(ValidationError):
        mpesa.normalize_phone(raw)


def test_cents_are_rounded_up_to_whole_shillings():
    assert mpesa.whole_shillings(Decimal("201.00")) == 201
    assert mpesa.whole_shillings(Decimal("201.01")) == 202


# ---------- sending the prompt ----------


def test_pay_sends_a_prompt_and_records_the_attempt(buyer, order, pushes):
    client, _ = buyer

    response = prompt(client, order)

    assert response.status_code == 202
    [sent] = pushes
    assert sent["phone"] == "254712345678"
    assert sent["amount"] == 201  # 2 x 100.50
    assert sent["reference"] == order.order_number
    assert sent["callback_url"] == f"https://shop.example{CALLBACK}"
    payment = Payment.objects.get()
    assert payment.status == Payment.Status.PENDING
    assert payment.checkout_request_id == "ws_CO_1"
    assert payment.order == order


def test_a_second_prompt_within_a_minute_is_refused(buyer, order, pushes):
    client, _ = buyer
    prompt(client, order)

    response = prompt(client, order)

    assert response.status_code == 400
    assert len(pushes) == 1


def test_pay_requires_login(api_client, order, pushes):
    assert prompt(api_client, order).status_code == 401


def test_nobody_can_pay_for_someone_elses_order(order, pushes):
    stranger = APIClient()
    stranger.force_authenticate(
        User.objects.create_user(
            email="x@example.com", password=PASSWORD, first_name="X", last_name="Y"
        )
    )

    assert prompt(stranger, order).status_code == 404
    assert pushes == []


def test_an_order_that_is_not_awaiting_payment_cannot_be_paid(buyer, order, pushes):
    client, _ = buyer
    order_services.cancel_order(order)

    assert prompt(client, order).status_code == 400
    assert pushes == []


def test_an_expired_reservation_cannot_be_paid(buyer, order, pushes):
    client, _ = buyer
    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timezone.timedelta(minutes=1)
    )

    assert prompt(client, order).status_code == 400
    assert pushes == []


def test_a_safaricom_failure_marks_the_attempt_failed(buyer, order, monkeypatch):
    client, _ = buyer

    def broken(**kwargs):
        raise mpesa.MpesaError("We could not reach M-Pesa. Please try again.")

    monkeypatch.setattr(mpesa, "stk_push", broken)

    response = prompt(client, order)

    assert response.status_code == 400
    assert Payment.objects.get().status == Payment.Status.FAILED


def test_payments_are_refused_until_m_pesa_is_configured(
    buyer, order, pushes, settings
):
    client, _ = buyer
    settings.MPESA_CONSUMER_KEY = ""

    assert prompt(client, order).status_code == 400
    assert pushes == []


def test_a_test_amount_charges_that_instead_of_the_order_total(
    api_client, buyer, order, pushes, settings
):
    settings.MPESA_TEST_AMOUNT = "1"

    prompt(buyer[0], order)

    assert pushes[0]["amount"] == 1
    assert Payment.objects.get().amount == 1
    # the order is still worth 201, but a callback for the 1 shilling charged settles it
    api_client.post(CALLBACK, callback_body("ws_CO_1", amount=1), format="json")
    order.refresh_from_db()
    assert order.status == "PAID"


# ---------- the callback ----------


def test_the_callback_needs_the_secret_token(api_client, buyer, order, pushes):
    prompt(buyer[0], order)

    wrong = api_client.post(
        "/api/v1/payments/mpesa/callback/not-the-token/",
        callback_body("ws_CO_1"),
        format="json",
    )

    assert wrong.status_code == 404
    order.refresh_from_db()
    assert order.status == "PENDING_PAYMENT"


def test_a_successful_payment_marks_the_order_paid_and_sells_the_stock(
    api_client, buyer, order, pushes
):
    prompt(buyer[0], order)
    assert stock_of(order) == (10, 2)

    response = api_client.post(CALLBACK, callback_body("ws_CO_1"), format="json")

    assert response.status_code == 200
    assert response.json() == {"ResultCode": 0, "ResultDesc": "Accepted"}
    order.refresh_from_db()
    assert order.status == "PAID"
    assert order.reservation_expires_at is None
    payment = Payment.objects.get()
    assert payment.status == Payment.Status.SUCCESS
    assert payment.provider_transaction_id == "QGR7ABC123"
    assert payment.completed_at is not None
    assert payment.raw_callback["Body"]["stkCallback"]["ResultCode"] == 0
    assert stock_of(order) == (8, 0)  # sold, no longer merely held


def test_the_same_callback_twice_changes_nothing_the_second_time(
    api_client, buyer, order, pushes
):
    prompt(buyer[0], order)
    api_client.post(CALLBACK, callback_body("ws_CO_1"), format="json")

    api_client.post(CALLBACK, callback_body("ws_CO_1"), format="json")

    assert stock_of(order) == (8, 0)
    assert Payment.objects.get().status == Payment.Status.SUCCESS


def test_a_dismissed_prompt_leaves_the_order_waiting_and_the_stock_held(
    api_client, buyer, order, pushes
):
    prompt(buyer[0], order)

    api_client.post(CALLBACK, callback_body("ws_CO_1", code=1032), format="json")

    order.refresh_from_db()
    assert order.status == "PENDING_PAYMENT"
    assert Payment.objects.get().status == Payment.Status.CANCELLED
    assert stock_of(order) == (10, 2)


def test_a_failed_payment_can_be_retried(api_client, buyer, order, pushes):
    client, _ = buyer
    prompt(client, order)
    api_client.post(CALLBACK, callback_body("ws_CO_1", code=2001), format="json")
    Payment.objects.update(created_at=timezone.now() - timezone.timedelta(minutes=5))

    response = prompt(client, order)

    assert response.status_code == 202
    assert Payment.objects.count() == 2


def test_paying_too_little_is_not_accepted(api_client, buyer, order, pushes):
    prompt(buyer[0], order)

    api_client.post(CALLBACK, callback_body("ws_CO_1", amount=100), format="json")

    order.refresh_from_db()
    assert order.status == "PENDING_PAYMENT"
    payment = Payment.objects.get()
    assert payment.status == Payment.Status.FAILED
    assert "manual review" in payment.failure_reason


def test_money_arriving_after_a_cancel_is_flagged_for_refund(
    api_client, buyer, order, pushes
):
    prompt(buyer[0], order)
    order_services.cancel_order(order)

    api_client.post(CALLBACK, callback_body("ws_CO_1"), format="json")

    order.refresh_from_db()
    assert order.status == "CANCELLED"
    payment = Payment.objects.get()
    assert payment.status == Payment.Status.REFUND_PENDING
    assert stock_of(order) == (10, 0)  # the cancel already released it; nothing sold


def test_a_callback_for_an_unknown_request_is_acknowledged_and_ignored(api_client, db):
    response = api_client.post(CALLBACK, callback_body("ws_CO_nope"), format="json")

    assert response.status_code == 200


def test_the_order_shows_the_latest_payment(buyer, order, pushes, api_client):
    client, _ = buyer
    assert client.get(f"/api/v1/orders/{order.order_number}/").json()["payment"] is None

    prompt(client, order)
    api_client.post(CALLBACK, callback_body("ws_CO_1", code=2001), format="json")

    payment = client.get(f"/api/v1/orders/{order.order_number}/").json()["payment"]
    assert payment["status"] == "FAILED"
    assert payment["method"] == "MPESA_STK"
