from itertools import product

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from orders.models import Order
from orders.transitions import ALLOWED_TRANSITIONS, can_transition, transition
from orders.tests.test_order_models import make_order

pytestmark = pytest.mark.django_db

S = Order.Status

VALID = [
    (S.PENDING_PAYMENT, S.PAID),
    (S.PENDING_PAYMENT, S.CANCELLED),
    (S.PAID, S.PROCESSING),
    (S.PAID, S.CANCELLED),
    (S.PROCESSING, S.SHIPPED),
    (S.PROCESSING, S.CANCELLED),
    (S.SHIPPED, S.OUT_FOR_DELIVERY),
    (S.OUT_FOR_DELIVERY, S.DELIVERED),
]
INVALID = [pair for pair in product(S, S) if pair not in VALID]


@pytest.mark.parametrize("current, new", VALID)
def test_valid_transitions_are_allowed(current, new):
    assert can_transition(current, new)


@pytest.mark.parametrize("current, new", INVALID)
def test_every_other_transition_is_refused(current, new):
    assert not can_transition(current, new)


def test_every_status_has_a_rule():
    assert set(ALLOWED_TRANSITIONS) == set(S)


@pytest.mark.parametrize("final", [S.DELIVERED, S.CANCELLED])
def test_final_states_cannot_be_left(final):
    assert ALLOWED_TRANSITIONS[final] == set()


def test_transition_updates_the_order(user):
    order = make_order(user, reservation_expires_at=timezone.now())

    transition(order, S.PAID)
    order.refresh_from_db()

    assert order.status == S.PAID
    assert order.reservation_expires_at is None  # the payment clock stops
    assert order.cancelled_at is None


def test_cancelling_stamps_the_cancel_time(user):
    order = make_order(user)

    transition(order, S.CANCELLED)
    order.refresh_from_db()

    assert order.status == S.CANCELLED
    assert order.cancelled_at is not None


def test_a_refused_transition_changes_nothing(user):
    order = make_order(user, status=S.DELIVERED)

    with pytest.raises(ValidationError):
        transition(order, S.PENDING_PAYMENT)

    order.refresh_from_db()
    assert order.status == S.DELIVERED
