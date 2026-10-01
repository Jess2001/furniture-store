import pytest
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from accounts.models import User
from cart.models import Cart, CartItem
from catalog.models import Category, Product, ProductVariant
from conftest import PASSWORD
from inventory.models import Inventory

pytestmark = pytest.mark.django_db

CART = "/api/v1/cart/"
ITEMS = "/api/v1/cart/items/"
CLEAR = "/api/v1/cart/clear/"


def item_url(item_id):
    return f"/api/v1/cart/items/{item_id}/"


def stock(variant, quantity, reserved=0):
    Inventory.objects.filter(variant=variant).update(
        quantity=quantity, reserved_quantity=reserved
    )


def client_for(email):
    user = User.objects.create_user(
        email=email, password=PASSWORD, first_name="T", last_name="User"
    )
    client = APIClient()
    client.force_authenticate(user)
    return client, user


@pytest.fixture
def customer(db):
    return client_for("buyer@example.com")


@pytest.fixture
def client(customer):
    return customer[0]


@pytest.fixture
def variant(make_product):
    """One purchasable variant: price 100, 10 in stock."""
    variant = make_product("Oslo Sofa", prices=(100,)).variants.get()
    stock(variant, quantity=10)
    return variant


def add(client, variant, quantity=1):
    return client.post(
        ITEMS, {"variant_id": str(variant.id), "quantity": quantity}, format="json"
    )


# ---------- authentication ----------


@pytest.mark.parametrize(
    "method, url",
    [("get", CART), ("post", ITEMS), ("post", CLEAR)],
)
def test_cart_requires_authentication(api_client, method, url):
    assert getattr(api_client, method)(url).status_code == 401


# ---------- reading the cart ----------


def test_empty_cart_is_created_on_first_read(client, customer):
    response = client.get(CART)

    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["item_count"] == 0
    assert response.json()["subtotal"] == "0.00"
    assert response.json()["has_problems"] is False
    assert Cart.objects.filter(user=customer[1]).count() == 1


def test_reading_twice_does_not_create_two_carts(client, customer):
    client.get(CART)
    client.get(CART)

    assert Cart.objects.filter(user=customer[1]).count() == 1


# ---------- adding ----------


def test_add_item_returns_the_updated_cart(client, variant):
    response = add(client, variant, 2)

    body = response.json()
    assert response.status_code == 201
    assert body["item_count"] == 2
    assert body["subtotal"] == "200.00"
    line = body["items"][0]
    assert line["quantity"] == 2
    assert line["line_total"] == "200.00"
    assert line["variant"]["sku"] == variant.sku
    assert line["product"]["slug"] == "oslo-sofa"
    assert line["problem"] is None


def test_adding_the_same_variant_again_increases_the_quantity(client, variant):
    add(client, variant, 2)

    body = add(client, variant, 3).json()

    assert len(body["items"]) == 1
    assert body["items"][0]["quantity"] == 5


def test_quantity_defaults_to_one(client, variant):
    response = client.post(ITEMS, {"variant_id": str(variant.id)}, format="json")

    assert response.json()["items"][0]["quantity"] == 1


@pytest.mark.parametrize("quantity", [0, -1, "abc", 1.5])
def test_invalid_quantities_are_rejected(client, variant, quantity):
    response = add(client, variant, quantity)

    assert response.status_code == 400
    assert not CartItem.objects.exists()


def test_quantity_above_the_line_limit_is_rejected(client, variant):
    stock(variant, quantity=500)

    response = add(client, variant, 21)

    assert response.status_code == 400
    assert "at most 20" in str(response.json())


def test_unknown_variant_is_rejected(client):
    response = client.post(
        ITEMS, {"variant_id": "11111111-1111-1111-1111-111111111111"}, format="json"
    )

    assert response.status_code == 400
    assert "variant_id" in response.json()


def test_malformed_variant_id_is_rejected(client):
    assert client.post(ITEMS, {"variant_id": "nope"}, format="json").status_code == 400


def test_inactive_variant_cannot_be_added(client, variant):
    ProductVariant.objects.filter(pk=variant.pk).update(is_active=False)

    assert add(client, variant).status_code == 400


@pytest.mark.parametrize("status", [Product.Status.INACTIVE, Product.Status.ARCHIVED])
def test_variant_of_non_active_product_cannot_be_added(client, variant, status):
    Product.objects.filter(pk=variant.product_id).update(status=status)

    assert add(client, variant).status_code == 400


def test_variant_in_inactive_category_cannot_be_added(client, variant):
    Category.objects.filter(pk=variant.product.category_id).update(is_active=False)

    assert add(client, variant).status_code == 400


# ---------- stock validation ----------


def test_cannot_add_more_than_is_available(client, variant):
    stock(variant, quantity=3)

    response = add(client, variant, 4)

    assert response.status_code == 400
    assert "Only 3 available" in str(response.json())


def test_reserved_stock_is_not_available(client, variant):
    stock(variant, quantity=5, reserved=4)

    assert add(client, variant, 2).status_code == 400
    assert add(client, variant, 1).status_code == 201


def test_out_of_stock_variant_cannot_be_added(client, variant):
    stock(variant, quantity=0)

    response = add(client, variant)

    assert response.status_code == 400
    assert "out of stock" in str(response.json())


def test_repeated_adds_cannot_exceed_stock_in_total(client, variant):
    stock(variant, quantity=4)
    add(client, variant, 3)

    response = add(client, variant, 2)

    assert response.status_code == 400
    assert CartItem.objects.get().quantity == 3


# ---------- updating ----------


def test_update_sets_the_quantity(client, variant):
    line = add(client, variant, 1).json()["items"][0]

    body = client.patch(item_url(line["id"]), {"quantity": 4}, format="json").json()

    assert body["items"][0]["quantity"] == 4
    assert body["subtotal"] == "400.00"


def test_update_cannot_exceed_stock(client, variant):
    stock(variant, quantity=3)
    line = add(client, variant, 1).json()["items"][0]

    response = client.patch(item_url(line["id"]), {"quantity": 9}, format="json")

    assert response.status_code == 400
    assert CartItem.objects.get().quantity == 1


@pytest.mark.parametrize("quantity", [0, -2])
def test_update_to_zero_or_less_is_rejected(client, variant, quantity):
    line = add(client, variant, 2).json()["items"][0]

    response = client.patch(item_url(line["id"]), {"quantity": quantity}, format="json")

    assert response.status_code == 400
    assert CartItem.objects.get().quantity == 2


# ---------- removing and clearing ----------


def test_delete_removes_the_line(client, variant):
    line = add(client, variant, 2).json()["items"][0]

    body = client.delete(item_url(line["id"])).json()

    assert body["items"] == []
    assert body["subtotal"] == "0.00"


def test_clear_empties_the_cart(client, make_product):
    for name in ("Sofa One", "Sofa Two"):
        variant = make_product(name, prices=(50,)).variants.get()
        stock(variant, quantity=5)
        add(client, variant)

    body = client.post(CLEAR).json()

    assert body["items"] == []
    assert CartItem.objects.count() == 0


# ---------- isolation between customers ----------


def test_customers_have_separate_carts(client, variant):
    other_client, _ = client_for("other@example.com")
    add(client, variant, 2)

    assert other_client.get(CART).json()["items"] == []


def test_cannot_update_or_delete_another_customers_item(client, variant):
    other_client, _ = client_for("other@example.com")
    line = add(client, variant, 2).json()["items"][0]

    assert (
        other_client.patch(
            item_url(line["id"]), {"quantity": 1}, format="json"
        ).status_code
        == 404
    )
    assert other_client.delete(item_url(line["id"])).status_code == 404
    assert CartItem.objects.get().quantity == 2


def test_clearing_only_affects_your_own_cart(client, variant):
    other_client, _ = client_for("other@example.com")
    stock(variant, quantity=10)
    add(client, variant, 1)
    add(other_client, variant, 1)

    client.post(CLEAR)

    assert CartItem.objects.count() == 1


# ---------- totals use live prices ----------


def test_subtotal_adds_all_lines_at_current_prices(client, make_product):
    first = make_product("Sofa One", prices=(100,)).variants.get()
    second = make_product("Sofa Two", prices=(250,)).variants.get()
    for variant in (first, second):
        stock(variant, quantity=10)
    add(client, first, 2)
    add(client, second, 1)

    assert client.get(CART).json()["subtotal"] == "450.00"

    ProductVariant.objects.filter(pk=first.pk).update(price=120)

    assert client.get(CART).json()["subtotal"] == "490.00"


# ---------- lines that went bad after being added ----------


def test_line_is_flagged_when_variant_is_deactivated(client, variant):
    add(client, variant, 2)
    ProductVariant.objects.filter(pk=variant.pk).update(is_active=False)

    body = client.get(CART).json()

    assert body["items"][0]["problem"] == "unavailable"
    assert body["has_problems"] is True


def test_line_is_flagged_when_stock_drops_below_quantity(client, variant):
    add(client, variant, 5)
    stock(variant, quantity=3)

    line = client.get(CART).json()["items"][0]

    assert line["problem"] == "insufficient_stock"
    assert line["max_available"] == 3


def test_line_is_flagged_when_sold_out(client, variant):
    add(client, variant, 2)
    stock(variant, quantity=0)

    line = client.get(CART).json()["items"][0]

    assert line["problem"] == "out_of_stock"
    assert line["max_available"] is None


# ---------- database rules ----------


def test_cart_item_quantity_must_be_at_least_one(customer, variant):
    cart = Cart.objects.create(user=customer[1])

    with pytest.raises(IntegrityError), transaction.atomic():
        CartItem.objects.create(cart=cart, variant=variant, quantity=0)


def test_a_variant_can_only_appear_once_per_cart(customer, variant):
    cart = Cart.objects.create(user=customer[1])
    CartItem.objects.create(cart=cart, variant=variant, quantity=1)

    with pytest.raises(IntegrityError), transaction.atomic():
        CartItem.objects.create(cart=cart, variant=variant, quantity=2)


def test_a_customer_cannot_have_two_carts(customer):
    Cart.objects.create(user=customer[1])

    with pytest.raises(IntegrityError), transaction.atomic():
        Cart.objects.create(user=customer[1])


# ---------- performance ----------


def test_cart_read_does_not_query_per_line(
    client, make_product, django_assert_max_num_queries
):
    for i in range(6):
        variant = make_product(f"Sofa {i}", prices=(100 + i,)).variants.get()
        stock(variant, quantity=10)
        add(client, variant)

    with django_assert_max_num_queries(5):
        assert client.get(CART).status_code == 200
