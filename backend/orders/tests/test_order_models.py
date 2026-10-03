import re
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.utils import timezone

from accounts.models import User
from conftest import PASSWORD
from orders.models import Delivery, Order, OrderItem
from orders.numbers import ALPHABET, generate_order_number

pytestmark = pytest.mark.django_db

_counter = iter(range(1, 10_000))


def make_order(user, **overrides):
    fields = {
        "user": user,
        "order_number": f"KL-TEST{next(_counter):04d}",
        "subtotal": Decimal("1000.00"),
        "shipping_fee": Decimal("200.00"),
        "total_amount": Decimal("1200.00"),
        "recipient_name": "Jane Doe",
        "recipient_phone": "+254700000000",
        "address_line_1": "Ngong Road",
        "city": "Nairobi",
        "county": "Nairobi",
    }
    fields.update(overrides)
    return Order.objects.create(**fields)


def make_item(order, **overrides):
    fields = {
        "order": order,
        "product_name": "Oslo Sofa",
        "variant_name": "Grey",
        "sku": "OSLO-GRY",
        "quantity": 2,
        "unit_price": Decimal("500.00"),
        "line_total": Decimal("1000.00"),
    }
    fields.update(overrides)
    return OrderItem.objects.create(**fields)


# ---------- money must add up, enforced by the database ----------


def test_total_must_equal_subtotal_plus_shipping(user):
    make_order(user)  # 1000 + 200 = 1200 is fine

    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user, total_amount=Decimal("1500.00"))


def test_amounts_cannot_be_negative(user):
    for field in ("subtotal", "shipping_fee"):
        with pytest.raises(IntegrityError), transaction.atomic():
            make_order(user, **{field: Decimal("-1.00")})


def test_line_total_must_equal_quantity_times_unit_price(user):
    order = make_order(user)
    make_item(order)  # 2 x 500 = 1000 is fine

    with pytest.raises(IntegrityError), transaction.atomic():
        make_item(order, line_total=Decimal("999.00"))


def test_item_quantity_must_be_positive(user):
    order = make_order(user)

    with pytest.raises(IntegrityError), transaction.atomic():
        make_item(order, quantity=0, line_total=Decimal("0.00"))


# ---------- cancellation consistency ----------


def test_cancelled_order_must_have_a_cancel_time(user):
    make_order(user, status=Order.Status.CANCELLED, cancelled_at=timezone.now())

    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user, status=Order.Status.CANCELLED)


def test_active_order_cannot_have_a_cancel_time(user):
    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user, status=Order.Status.PAID, cancelled_at=timezone.now())


# ---------- order numbers ----------


def test_order_numbers_are_unique(user):
    make_order(user, order_number="KL-SAME2222")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user, order_number="KL-SAME2222")


def test_generated_order_numbers_are_readable_and_distinct():
    numbers = {generate_order_number() for _ in range(2000)}

    assert len(numbers) == 2000
    for number in numbers:
        assert re.fullmatch(r"KL-[A-Z2-9]{8}", number)
        assert set(number[3:]) <= set(ALPHABET)
    assert not any(ch in "ILO01" for number in numbers for ch in number[3:])


# ---------- history must survive ----------


def test_customer_with_orders_cannot_be_deleted(user):
    make_order(user)

    with pytest.raises(ProtectedError):
        user.delete()


def test_order_keeps_working_when_the_staff_creator_is_deleted(user):
    staff = User.objects.create_user(
        email="staff@example.com",
        password=PASSWORD,
        first_name="S",
        last_name="T",
        role=User.Role.STAFF,
    )
    order = make_order(user, created_by=staff)

    staff.delete()
    order.refresh_from_db()

    assert order.created_by is None


def test_order_item_snapshot_survives_variant_deletion(user, make_product):
    variant = make_product("Oslo Sofa", prices=(500,)).variants.get()
    item = make_item(make_order(user), variant=variant, product=variant.product)

    variant.delete()
    item.refresh_from_db()

    assert item.variant is None
    assert item.product_name == "Oslo Sofa"
    assert item.unit_price == Decimal("500.00")


# ---------- delivery ----------


def test_an_order_has_at_most_one_delivery(user):
    order = make_order(user)
    Delivery.objects.create(order=order, carrier="Kilima Fleet")

    with pytest.raises(IntegrityError), transaction.atomic():
        Delivery.objects.create(order=order)


def test_delivery_has_no_status_of_its_own():
    assert "status" not in {f.name for f in Delivery._meta.get_fields()}
