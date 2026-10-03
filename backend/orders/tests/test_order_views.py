import pytest
from rest_framework.test import APIClient

from accounts.models import User
from cart.services import add_item, get_or_create_cart
from conftest import PASSWORD
from inventory.models import Inventory
from orders import services
from orders.models import Order
from orders.tests.test_checkout import SHIPPING

pytestmark = pytest.mark.django_db

ORDERS = "/api/v1/orders/"


def detail_url(order):
    return f"{ORDERS}{order.order_number}/"


def cancel_url(order):
    return f"{ORDERS}{order.order_number}/cancel/"


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


def reserved(variant):
    return Inventory.objects.get(variant=variant).reserved_quantity


def place_order(user, *lines):
    """lines: (variant, quantity) pairs. Goes through the real cart and checkout."""
    cart = get_or_create_cart(user)
    for variant, quantity in lines:
        add_item(cart, variant.id, quantity)
    return services.checkout(user, dict(SHIPPING))


@pytest.fixture
def customer(db):
    return client_for()


@pytest.fixture
def variant(make_product):
    variant = make_product("Oslo Sofa", prices=(100,)).variants.get()
    stock(variant, quantity=10)
    return variant


# ---------- history ----------


def test_order_endpoints_require_authentication(api_client):
    assert api_client.get(ORDERS).status_code == 401
    assert api_client.get(f"{ORDERS}KL-ABCDEFGH/").status_code == 401
    assert api_client.post(f"{ORDERS}KL-ABCDEFGH/cancel/").status_code == 401


def test_list_shows_only_my_orders_newest_first(customer, variant):
    client, user = customer
    _, other = client_for("other@example.com")
    first = place_order(user, (variant, 1))
    second = place_order(user, (variant, 2))
    place_order(other, (variant, 1))

    body = client.get(ORDERS).json()

    assert body["count"] == 2
    assert [o["order_number"] for o in body["results"]] == [
        second.order_number,
        first.order_number,
    ]
    newest = body["results"][0]
    assert newest["item_count"] == 2
    assert newest["status"] == "PENDING_PAYMENT"
    assert newest["total_amount"] == "200.00"
    assert newest["can_cancel"] is True


def test_empty_history(customer):
    client, _ = customer

    body = client.get(ORDERS).json()

    assert body["count"] == 0 and body["results"] == []


def test_list_is_paginated(customer, make_product):
    client, user = customer
    for i in range(14):
        v = make_product(f"Sofa {i}", prices=(10,)).variants.get()
        stock(v, quantity=5)
        place_order(user, (v, 1))

    first = client.get(ORDERS).json()
    second = client.get(ORDERS, {"page": 2}).json()

    assert first["count"] == 14 and len(first["results"]) == 12
    assert len(second["results"]) == 2
    numbers = [o["order_number"] for o in first["results"] + second["results"]]
    assert len(set(numbers)) == 14


def test_list_query_count_does_not_grow(
    customer, make_product, django_assert_max_num_queries
):
    client, user = customer
    for i in range(6):
        v = make_product(f"Sofa {i}", prices=(10,)).variants.get()
        stock(v, quantity=5)
        place_order(user, (v, 1))

    with django_assert_max_num_queries(3):
        assert client.get(ORDERS).status_code == 200


# ---------- detail ----------


def test_detail_by_order_number(customer, variant):
    client, user = customer
    order = place_order(user, (variant, 2))

    body = client.get(detail_url(order)).json()

    assert body["order_number"] == order.order_number
    assert body["items"][0]["sku"] == variant.sku
    assert body["shipping_address"]["city"] == "Nairobi"
    assert body["total_amount"] == "200.00"
    assert body["can_cancel"] is True


def test_cannot_see_another_customers_order(customer, variant):
    client, _ = customer
    _, other = client_for("other@example.com")
    order = place_order(other, (variant, 1))

    assert client.get(detail_url(order)).status_code == 404


def test_unknown_order_number_is_404(customer):
    client, _ = customer

    assert client.get(f"{ORDERS}KL-NOPE2222/").status_code == 404


def test_detail_query_count_is_flat(
    customer, make_product, django_assert_max_num_queries
):
    client, user = customer
    lines = []
    for i in range(5):
        v = make_product(f"Sofa {i}", prices=(10,)).variants.get()
        stock(v, quantity=5)
        lines.append((v, 1))
    order = place_order(user, *lines)

    with django_assert_max_num_queries(3):
        assert client.get(detail_url(order)).status_code == 200


# ---------- cancelling ----------


def test_cancel_releases_the_reserved_stock(customer, variant):
    client, user = customer
    order = place_order(user, (variant, 3))
    assert reserved(variant) == 3

    response = client.post(cancel_url(order))

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "CANCELLED"
    assert body["cancelled_at"] is not None
    assert body["reservation_expires_at"] is None
    assert body["can_cancel"] is False
    assert reserved(variant) == 0
    assert Inventory.objects.get(variant=variant).quantity == 10


def test_cancel_releases_every_line(customer, make_product):
    client, user = customer
    a = make_product("Sofa One", prices=(10,)).variants.get()
    b = make_product("Sofa Two", prices=(10,)).variants.get()
    stock(a, quantity=5)
    stock(b, quantity=5)
    order = place_order(user, (a, 2), (b, 4))

    client.post(cancel_url(order))

    assert reserved(a) == 0 and reserved(b) == 0


def test_cancelling_twice_releases_stock_only_once(customer, variant):
    client, user = customer
    order = place_order(user, (variant, 3))
    other_hold = 4
    Inventory.objects.filter(variant=variant).update(
        reserved_quantity=3 + other_hold
    )  # someone else's hold too

    first = client.post(cancel_url(order))
    second = client.post(cancel_url(order))

    assert first.status_code == 200
    assert second.status_code == 400
    assert "already cancelled" in str(second.json())
    assert reserved(variant) == other_hold


@pytest.mark.parametrize(
    "status",
    [
        Order.Status.PAID,
        Order.Status.PROCESSING,
        Order.Status.SHIPPED,
        Order.Status.OUT_FOR_DELIVERY,
        Order.Status.DELIVERED,
    ],
)
def test_orders_past_payment_cannot_be_cancelled_online(customer, variant, status):
    client, user = customer
    order = place_order(user, (variant, 2))
    Order.objects.filter(pk=order.pk).update(status=status, reservation_expires_at=None)

    response = client.post(cancel_url(order))

    assert response.status_code == 400
    assert "contact us" in str(response.json())
    order.refresh_from_db()
    assert order.status == status
    assert reserved(variant) == 2


def test_cannot_cancel_another_customers_order(customer, variant):
    client, _ = customer
    _, other = client_for("other@example.com")
    order = place_order(other, (variant, 1))

    assert client.post(cancel_url(order)).status_code == 404
    order.refresh_from_db()
    assert order.status == Order.Status.PENDING_PAYMENT
    assert reserved(variant) == 1


def test_cancelled_stock_can_be_bought_by_someone_else(variant):
    first_client, first = client_for("first@example.com")
    _, second = client_for("second@example.com")
    stock(variant, quantity=1)
    order = place_order(first, (variant, 1))  # the only unit is now reserved

    first_client.post(cancel_url(order))
    second_order = place_order(second, (variant, 1))  # it is for sale again

    assert second_order.status == Order.Status.PENDING_PAYMENT
    assert reserved(variant) == 1


def test_cancel_still_works_when_a_variant_was_deleted(customer, make_product):
    client, user = customer
    a = make_product("Sofa One", prices=(10,)).variants.get()
    b = make_product("Sofa Two", prices=(10,)).variants.get()
    stock(a, quantity=5)
    stock(b, quantity=5)
    order = place_order(user, (a, 2), (b, 3))
    a.delete()  # its order line keeps the snapshot but loses the live link

    response = client.post(cancel_url(order))

    assert response.status_code == 200
    assert reserved(b) == 0
