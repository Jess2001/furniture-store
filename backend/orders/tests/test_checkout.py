import re
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from cart.models import CartItem
from cart.services import add_item, get_or_create_cart
from catalog.models import Product, ProductVariant
from conftest import PASSWORD
from inventory.models import Inventory
from orders import services
from orders.models import Order

pytestmark = pytest.mark.django_db

CHECKOUT = "/api/v1/orders/checkout/"

SHIPPING = {
    "recipient_name": "Jane Doe",
    "recipient_phone": "+254 700 000 000",
    "address_line_1": "Ngong Road",
    "address_line_2": "Apt 4B",
    "city": "Nairobi",
    "county": "Nairobi",
    "postal_code": "00100",
}


def client_for(email="buyer@example.com"):
    user = User.objects.create_user(
        email=email, password=PASSWORD, first_name="T", last_name="User"
    )
    client = APIClient()
    client.force_authenticate(user)
    return client, user


def stock(variant, quantity, reserved=0):
    Inventory.objects.filter(variant=variant).update(
        quantity=quantity, reserved_quantity=reserved
    )


def put_in_cart(user, variant, quantity=1):
    add_item(get_or_create_cart(user), variant.id, quantity)


def reserved(variant):
    return Inventory.objects.get(variant=variant).reserved_quantity


@pytest.fixture
def customer(db):
    return client_for()


@pytest.fixture
def variant(make_product):
    """price 100, 10 in stock"""
    variant = make_product("Oslo Sofa", prices=(100,)).variants.get()
    stock(variant, quantity=10)
    return variant


def checkout(client, **overrides):
    return client.post(CHECKOUT, {**SHIPPING, **overrides}, format="json")


# ---------- the happy path ----------


def test_checkout_requires_authentication(api_client):
    assert api_client.post(CHECKOUT, SHIPPING, format="json").status_code == 401


def test_checkout_creates_a_pending_order_with_snapshots(customer, variant):
    client, user = customer
    put_in_cart(user, variant, 3)

    response = checkout(client)

    assert response.status_code == 201
    body = response.json()
    assert re.fullmatch(r"KL-[A-Z2-9]{8}", body["order_number"])
    assert body["status"] == "PENDING_PAYMENT"
    assert body["currency"] == "KES"
    assert body["subtotal"] == "300.00"
    assert body["shipping_fee"] == "0.00"
    assert body["total_amount"] == "300.00"
    assert body["shipping_address"]["recipient_name"] == "Jane Doe"
    assert body["shipping_address"]["address_line_2"] == "Apt 4B"
    assert body["shipping_address"]["country"] == "Kenya"
    [line] = body["items"]
    assert line["product_name"] == "Oslo Sofa"
    assert line["sku"] == variant.sku
    assert (line["quantity"], line["unit_price"], line["line_total"]) == (
        3,
        "100.00",
        "300.00",
    )

    order = Order.objects.get()
    assert order.user == user
    assert order.created_by is None


def test_checkout_reserves_stock_and_empties_the_cart(customer, variant):
    client, user = customer
    put_in_cart(user, variant, 3)

    checkout(client)

    inventory = Inventory.objects.get(variant=variant)
    assert inventory.reserved_quantity == 3
    assert inventory.quantity == 10  # reserved, not yet shipped
    assert CartItem.objects.count() == 0


def test_reservation_expires_after_the_configured_time(customer, variant, settings):
    settings.ORDER_RESERVATION_MINUTES = 30
    client, user = customer
    put_in_cart(user, variant)

    before = timezone.now()
    checkout(client)
    after = timezone.now()

    expires = Order.objects.get().reservation_expires_at
    assert before + timedelta(minutes=30) <= expires <= after + timedelta(minutes=30)


def test_shipping_fee_comes_from_settings(customer, variant, settings):
    settings.SHIPPING_FLAT_FEE = Decimal("500.00")
    client, user = customer
    put_in_cart(user, variant, 2)

    body = checkout(client).json()

    assert body["subtotal"] == "200.00"
    assert body["shipping_fee"] == "500.00"
    assert body["total_amount"] == "700.00"


def test_multiple_lines_are_totalled(customer, make_product):
    client, user = customer
    first = make_product("Sofa One", prices=(100,)).variants.get()
    second = make_product("Sofa Two", prices=(250,)).variants.get()
    for v in (first, second):
        stock(v, quantity=10)
    put_in_cart(user, first, 2)
    put_in_cart(user, second, 1)

    body = checkout(client).json()

    assert body["subtotal"] == "450.00"
    assert len(body["items"]) == 2
    assert reserved(first) == 2 and reserved(second) == 1


def test_order_keeps_the_price_it_was_sold_at(customer, variant):
    client, user = customer
    put_in_cart(user, variant, 2)
    checkout(client)

    ProductVariant.objects.filter(pk=variant.pk).update(price=999)

    item = Order.objects.get().items.get()
    assert item.unit_price == Decimal("100.00")
    assert item.line_total == Decimal("200.00")


# ---------- the cart must be usable ----------


def test_empty_cart_cannot_check_out(customer):
    client, _ = customer

    response = checkout(client)

    assert response.status_code == 400
    assert "empty" in str(response.json())
    assert not Order.objects.exists()


def test_submitting_twice_creates_only_one_order(customer, variant):
    client, user = customer
    put_in_cart(user, variant, 2)

    first = checkout(client)
    second = checkout(client)

    assert first.status_code == 201
    assert second.status_code == 400
    assert Order.objects.count() == 1
    assert reserved(variant) == 2


# ---------- shipping details ----------


@pytest.mark.parametrize(
    "field", ["recipient_name", "recipient_phone", "address_line_1", "city", "county"]
)
def test_required_shipping_fields(customer, variant, field):
    client, user = customer
    put_in_cart(user, variant)
    payload = {k: v for k, v in SHIPPING.items() if k != field}

    response = client.post(CHECKOUT, payload, format="json")

    assert response.status_code == 400
    assert field in response.json()
    assert not Order.objects.exists()
    assert CartItem.objects.count() == 1
    assert reserved(variant) == 0


@pytest.mark.parametrize("phone", ["abc", "12", "+254-700-AAA-000"])
def test_invalid_phone_numbers_are_rejected(customer, variant, phone):
    client, user = customer
    put_in_cart(user, variant)

    response = checkout(client, recipient_phone=phone)

    assert response.status_code == 400
    assert "recipient_phone" in response.json()


# ---------- stock and availability ----------


def test_insufficient_stock_blocks_checkout_and_changes_nothing(customer, variant):
    client, user = customer
    put_in_cart(user, variant, 5)
    stock(variant, quantity=3)  # stock dropped after it was carted

    response = checkout(client)

    assert response.status_code == 400
    assert "only 3 available" in str(response.json())
    assert not Order.objects.exists()
    assert reserved(variant) == 0
    assert CartItem.objects.count() == 1


def test_stock_reserved_by_other_orders_is_not_available(customer, variant):
    client, user = customer
    put_in_cart(user, variant, 2)
    stock(variant, quantity=5, reserved=4)

    response = checkout(client)

    assert response.status_code == 400
    assert "only 1 available" in str(response.json())


def test_all_problem_lines_are_reported_together(customer, make_product):
    client, user = customer
    a = make_product("Sofa One", prices=(100,)).variants.get()
    b = make_product("Sofa Two", prices=(100,)).variants.get()
    stock(a, quantity=10)
    stock(b, quantity=10)
    put_in_cart(user, a, 2)
    put_in_cart(user, b, 2)
    stock(a, quantity=0)
    stock(b, quantity=1)

    messages = checkout(client).json()["cart"]

    assert len(messages) == 2
    assert any("out of stock" in m for m in messages)
    assert any("only 1 available" in m for m in messages)


@pytest.mark.parametrize("status", [Product.Status.INACTIVE, Product.Status.ARCHIVED])
def test_product_no_longer_sold_blocks_checkout(customer, variant, status):
    client, user = customer
    put_in_cart(user, variant)
    Product.objects.filter(pk=variant.product_id).update(status=status)

    response = checkout(client)

    assert response.status_code == 400
    assert "no longer available" in str(response.json())
    assert reserved(variant) == 0


def test_two_customers_cannot_both_buy_the_last_item(variant):
    first_client, first = client_for("first@example.com")
    second_client, second = client_for("second@example.com")
    stock(variant, quantity=1)
    put_in_cart(
        first, variant
    )  # both carts accept it: the cart only checks, it does not reserve
    put_in_cart(second, variant)

    won = checkout(first_client)
    lost = checkout(second_client)

    assert won.status_code == 201
    assert lost.status_code == 400
    assert "out of stock" in str(lost.json())
    assert Order.objects.count() == 1
    assert reserved(variant) == 1


# ---------- price check ----------


def test_matching_expected_subtotal_is_accepted(customer, variant):
    client, user = customer
    put_in_cart(user, variant, 2)

    assert checkout(client, expected_subtotal="200.00").status_code == 201


def test_changed_prices_are_caught_by_expected_subtotal(customer, variant):
    client, user = customer
    put_in_cart(user, variant, 2)
    ProductVariant.objects.filter(pk=variant.pk).update(price=120)

    response = checkout(client, expected_subtotal="200.00")

    assert response.status_code == 400
    assert "current subtotal is 240.00" in str(response.json())
    assert not Order.objects.exists()
    assert CartItem.objects.count() == 1


# ---------- all or nothing ----------


def test_a_failure_midway_rolls_everything_back(customer, variant, monkeypatch):
    _, user = customer
    put_in_cart(user, variant, 2)

    def explode(*args, **kwargs):
        raise RuntimeError("database went away")

    monkeypatch.setattr("orders.services.OrderItem.objects.bulk_create", explode)

    with pytest.raises(RuntimeError):
        services.checkout(user, {k: v for k, v in SHIPPING.items()})

    assert not Order.objects.exists()
    assert reserved(variant) == 0
    assert CartItem.objects.count() == 1


def test_order_number_collision_is_retried(customer, variant, monkeypatch):
    client, user = customer
    put_in_cart(user, variant)
    Order.objects.create(
        user=user,
        order_number="KL-AAAAAAAA",
        subtotal=0,
        shipping_fee=0,
        total_amount=0,
        recipient_name="x",
        recipient_phone="1234567",
        address_line_1="x",
        city="x",
        county="x",
    )
    numbers = iter(["KL-AAAAAAAA", "KL-BBBBBBBB"])
    monkeypatch.setattr("orders.services.generate_order_number", lambda: next(numbers))

    response = checkout(client)

    assert response.status_code == 201
    assert response.json()["order_number"] == "KL-BBBBBBBB"
