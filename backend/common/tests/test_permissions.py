from types import SimpleNamespace

import pytest
from django.contrib.auth.models import AnonymousUser

from accounts.models import User
from common.permissions import IsAdminRole, IsStaffRole

pytestmark = pytest.mark.django_db


def make_request(user):
    return SimpleNamespace(user=user)


def make_user(role):
    return User.objects.create_user(
        email=f"{role.lower()}@example.com",
        password="Sup3rSecret!!",
        first_name="T",
        last_name="User",
        role=role,
    )


@pytest.mark.parametrize(
    "role, allowed",
    [
        (User.Role.CUSTOMER, False),
        (User.Role.STAFF, True),
        (User.Role.ADMIN, True),
    ],
)
def test_is_staff_role(role, allowed):
    request = make_request(make_user(role))

    assert IsStaffRole().has_permission(request, None) is allowed


@pytest.mark.parametrize(
    "role, allowed",
    [
        (User.Role.CUSTOMER, False),
        (User.Role.STAFF, False),
        (User.Role.ADMIN, True),
    ],
)
def test_is_admin_role(role, allowed):
    request = make_request(make_user(role))

    assert IsAdminRole().has_permission(request, None) is allowed


def test_anonymous_user_is_denied_by_both():
    request = make_request(AnonymousUser())

    assert IsStaffRole().has_permission(request, None) is False
    assert IsAdminRole().has_permission(request, None) is False
