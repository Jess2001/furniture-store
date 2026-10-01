import pytest
from rest_framework.test import APIClient

from accounts.models import User

PASSWORD = "Sup3rSecret!!"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="jane@example.com",
        password=PASSWORD,
        first_name="Jane",
        last_name="Doe",
    )


@pytest.fixture
def auth_client(api_client, user):
    """An APIClient already logged in as `user`. Returns (client, tokens)."""
    response = api_client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": PASSWORD},
        format="json",
    )
    tokens = response.json()
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return api_client, tokens
