import pytest
from django.urls import reverse

from accounts.models import User
from conftest import PASSWORD

pytestmark = pytest.mark.django_db

REGISTER_PAYLOAD = {
    "email": "new@example.com",
    "first_name": "New",
    "last_name": "Person",
    "password": PASSWORD,
}


# ---------- registration ----------


def test_register_creates_customer(api_client):
    response = api_client.post(
        reverse("auth-register"), REGISTER_PAYLOAD, format="json"
    )

    assert response.status_code == 201
    assert "password" not in response.json()
    created = User.objects.get(email="new@example.com")
    assert created.role == User.Role.CUSTOMER
    assert created.check_password(PASSWORD)  # stored hashed, not plain text


def test_register_ignores_privilege_fields(api_client):
    payload = {
        **REGISTER_PAYLOAD,
        "role": "ADMIN",
        "is_staff": True,
        "is_superuser": True,
    }

    api_client.post(reverse("auth-register"), payload, format="json")

    created = User.objects.get(email="new@example.com")
    assert created.role == User.Role.CUSTOMER
    assert created.is_staff is False
    assert created.is_superuser is False


def test_register_rejects_duplicate_email_any_case(api_client, user):
    payload = {**REGISTER_PAYLOAD, "email": user.email.upper()}

    response = api_client.post(reverse("auth-register"), payload, format="json")

    assert response.status_code == 400
    assert "email" in response.json()


def test_register_rejects_weak_password(api_client):
    payload = {**REGISTER_PAYLOAD, "password": "12345678"}

    response = api_client.post(reverse("auth-register"), payload, format="json")

    assert response.status_code == 400
    assert "password" in response.json()
    assert not User.objects.filter(email="new@example.com").exists()


# ---------- login / refresh ----------


def test_login_returns_tokens(api_client, user):
    response = api_client.post(
        reverse("auth-login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
    )

    assert response.status_code == 200
    assert {"access", "refresh"} <= set(response.json())


def test_login_is_case_insensitive_on_email(api_client, user):
    response = api_client.post(
        reverse("auth-login"),
        {"email": user.email.upper(), "password": PASSWORD},
        format="json",
    )

    assert response.status_code == 200


def test_login_rejects_wrong_password(api_client, user):
    response = api_client.post(
        reverse("auth-login"), {"email": user.email, "password": "wrong"}, format="json"
    )

    assert response.status_code == 401


def test_refresh_rotates_and_old_token_stops_working(auth_client, api_client):
    _, tokens = auth_client

    first = api_client.post(
        reverse("auth-refresh"), {"refresh": tokens["refresh"]}, format="json"
    )
    reused = api_client.post(
        reverse("auth-refresh"), {"refresh": tokens["refresh"]}, format="json"
    )

    assert first.status_code == 200
    assert first.json()["refresh"] != tokens["refresh"]
    assert reused.status_code == 401


# ---------- /me ----------


def test_me_requires_authentication(api_client):
    response = api_client.get(reverse("auth-me"))

    assert response.status_code == 401


def test_me_returns_current_user(auth_client, user):
    client, _ = auth_client

    response = client.get(reverse("auth-me"))

    assert response.status_code == 200
    assert response.json()["email"] == user.email
    assert response.json()["role"] == "CUSTOMER"


# ---------- logout ----------


def test_logout_requires_authentication(api_client):
    response = api_client.post(reverse("auth-logout"), {"refresh": "x"}, format="json")

    assert response.status_code == 401


def test_logout_blacklists_refresh_token(auth_client):
    client, tokens = auth_client

    logout = client.post(
        reverse("auth-logout"), {"refresh": tokens["refresh"]}, format="json"
    )
    refresh = client.post(
        reverse("auth-refresh"), {"refresh": tokens["refresh"]}, format="json"
    )

    assert logout.status_code == 204
    assert refresh.status_code == 401


def test_logout_rejects_invalid_token(auth_client):
    client, _ = auth_client

    response = client.post(
        reverse("auth-logout"), {"refresh": "not-a-token"}, format="json"
    )

    assert response.status_code == 400


# ---------- manager ----------


def test_create_user_requires_email():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password=PASSWORD)


def test_create_superuser_sets_admin_flags():
    admin = User.objects.create_superuser(
        email="root@example.com", password=PASSWORD, first_name="Root", last_name="User"
    )

    assert admin.is_staff and admin.is_superuser
    assert admin.role == User.Role.ADMIN
