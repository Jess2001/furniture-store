import pytest
from django.utils.text import slugify
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Category, Product, ProductVariant

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


@pytest.fixture
def category(db):
    return Category.objects.create(name="Couches", slug="couches")


@pytest.fixture
def make_product(db, category):
    """Factory fixture: call it to build as many products as a test needs."""

    def _make(
        name="Oslo Sofa", prices=(100,), status=Product.Status.ACTIVE, cat=None, **extra
    ):
        product = Product.objects.create(
            category=cat or category,
            name=name,
            slug=slugify(name),
            status=status,
            **extra,
        )
        for index, price in enumerate(prices):
            ProductVariant.objects.create(
                product=product,
                sku=f"{product.slug}-{index}".upper(),
                price=price,
            )
        return product

    return _make


@pytest.fixture
def superuser_client(db):
    admin = User.objects.create_superuser(
        email="root@example.com", password=PASSWORD, first_name="Root", last_name="User"
    )
    client = APIClient()
    client.force_login(admin)
    return client
