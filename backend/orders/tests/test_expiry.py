from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from inventory.models import Inventory
from orders import services
from orders.models import Order
from orders.tests.test_order_views import client_for, place_order, reserved, stock

pytestmark = pytest.mark.django_db

S = Order.Status


@pytest.fixture
def variant(make_product):
    variant = make_product("Oslo Sofa", prices=(100,)).variants.get()
    stock(variant, quantity=10)
    return variant


@pytest.fixture
def buyer(db):
    return client_for()[1]


def make_stale(order, minutes_ago=5):
    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timedelta(minutes=minutes_ago)
    )
    order.refresh_from_db()
    return order


# ---------- what gets expired ----------


def test_stale_order_is_cancelled_and_its_stock_released(buyer, variant):
    order = make_stale(place_order(buyer, (variant, 3)))
    assert reserved(variant) == 3

    expired, failed = services.expire_stale_orders()

    order.refresh_from_db()
    assert (expired, failed) == (1, 0)
    assert order.status == S.CANCELLED
    assert order.cancelled_at is not None
    assert order.reservation_expires_at is None
    assert reserved(variant) == 0
    assert Inventory.objects.get(variant=variant).quantity == 10


def test_order_still_inside_its_window_is_left_alone(buyer, variant):
    order = place_order(buyer, (variant, 2))  # expires in the future

    expired, _ = services.expire_stale_orders()

    order.refresh_from_db()
    assert expired == 0
    assert order.status == S.PENDING_PAYMENT
    assert reserved(variant) == 2


@pytest.mark.parametrize("status", [S.PAID, S.PROCESSING, S.SHIPPED, S.DELIVERED])
def test_orders_that_moved_past_payment_are_never_expired(buyer, variant, status):
    order = place_order(buyer, (variant, 2))
    Order.objects.filter(pk=order.pk).update(
        status=status, reservation_expires_at=timezone.now() - timedelta(hours=1)
    )

    expired, _ = services.expire_stale_orders()

    order.refresh_from_db()
    assert expired == 0
    assert order.status == status
    assert reserved(variant) == 2


def test_cancelled_orders_do_not_release_stock_twice(buyer, variant):
    order = place_order(buyer, (variant, 3))
    Inventory.objects.filter(variant=variant).update(
        reserved_quantity=3 + 4
    )  # someone else holds 4
    services.cancel_order(order)  # customer cancels: back to 4 held
    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timedelta(hours=1)
    )

    expired, _ = services.expire_stale_orders()

    assert expired == 0
    assert reserved(variant) == 4


def test_only_stale_orders_in_a_mixed_batch_are_expired(variant, make_product):
    other = make_product("Sofa Two", prices=(50,)).variants.get()
    stock(other, quantity=10)
    stale_a = make_stale(place_order(client_for("a@example.com")[1], (variant, 2)))
    stale_b = make_stale(place_order(client_for("b@example.com")[1], (other, 1)))
    fresh = place_order(client_for("c@example.com")[1], (variant, 1))

    expired, failed = services.expire_stale_orders()

    assert (expired, failed) == (2, 0)
    for order in (stale_a, stale_b, fresh):
        order.refresh_from_db()
    assert (stale_a.status, stale_b.status, fresh.status) == (
        S.CANCELLED,
        S.CANCELLED,
        S.PENDING_PAYMENT,
    )
    assert reserved(variant) == 1 and reserved(other) == 0


def test_running_the_sweep_twice_is_harmless(buyer, variant):
    make_stale(place_order(buyer, (variant, 3)))

    first = services.expire_stale_orders()
    second = services.expire_stale_orders()

    assert first == (1, 0)
    assert second == (0, 0)
    assert reserved(variant) == 0


def test_expired_stock_can_be_bought_again(variant):
    stock(variant, quantity=1)
    make_stale(place_order(client_for("first@example.com")[1], (variant, 1)))
    services.expire_stale_orders()

    second_order = place_order(client_for("second@example.com")[1], (variant, 1))

    assert second_order.status == S.PENDING_PAYMENT


# ---------- safety ----------


def test_an_order_paid_after_the_sweep_chose_it_is_not_expired(buyer, variant):
    order = make_stale(place_order(buyer, (variant, 2)))
    stale_id = order.pk  # the sweep has picked this order...
    Order.objects.filter(pk=order.pk).update(
        status=S.PAID, reservation_expires_at=None
    )  # ...then it gets paid

    assert services.expire_order(stale_id) is False

    order.refresh_from_db()
    assert order.status == S.PAID
    assert reserved(variant) == 2


def test_one_failing_order_does_not_stop_the_others(variant, make_product, monkeypatch):
    other = make_product("Sofa Two", prices=(50,)).variants.get()
    stock(other, quantity=10)
    broken = make_stale(
        place_order(client_for("a@example.com")[1], (variant, 2)), minutes_ago=20
    )
    healthy = make_stale(
        place_order(client_for("b@example.com")[1], (other, 1)), minutes_ago=5
    )

    real_release = services.release_reservation

    def flaky(order):
        if order.pk == broken.pk:
            raise RuntimeError("boom")
        return real_release(order)

    monkeypatch.setattr(services, "release_reservation", flaky)

    expired, failed = services.expire_stale_orders()

    broken.refresh_from_db()
    healthy.refresh_from_db()
    assert (expired, failed) == (1, 1)
    assert healthy.status == S.CANCELLED
    assert broken.status == S.PENDING_PAYMENT  # rolled back, will be retried next sweep
    assert reserved(variant) == 2
    assert reserved(other) == 0


# ---------- the command ----------


def test_command_expires_stale_orders_and_reports(buyer, variant):
    make_stale(place_order(buyer, (variant, 2)))
    out = StringIO()

    call_command("expire_stale_orders", stdout=out)

    assert "Expired 1 order(s)." in out.getvalue()
    assert reserved(variant) == 0


def test_dry_run_changes_nothing(buyer, variant):
    order = make_stale(place_order(buyer, (variant, 2)))
    out = StringIO()

    call_command("expire_stale_orders", "--dry-run", stdout=out)

    order.refresh_from_db()
    assert "1 order(s) would be expired" in out.getvalue()
    assert order.status == S.PENDING_PAYMENT
    assert reserved(variant) == 2


def test_command_fails_loudly_when_an_order_cannot_be_expired(
    buyer, variant, monkeypatch
):
    make_stale(place_order(buyer, (variant, 2)))

    def boom(order):
        raise RuntimeError("boom")

    monkeypatch.setattr(services, "release_reservation", boom)

    with pytest.raises(CommandError):
        call_command("expire_stale_orders", stdout=StringIO())
