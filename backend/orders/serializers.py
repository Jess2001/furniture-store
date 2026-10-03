from django.core.validators import RegexValidator
from rest_framework import serializers

from .models import Order, OrderItem

phone_validator = RegexValidator(
    r"^\+?[0-9][0-9 ()-]{6,19}$",
    "Enter a valid phone number, e.g. +254 700 000 000.",
)


class CheckoutSerializer(serializers.Serializer):
    recipient_name = serializers.CharField(max_length=150)
    recipient_phone = serializers.CharField(max_length=30, validators=[phone_validator])
    address_line_1 = serializers.CharField(max_length=255)
    address_line_2 = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    city = serializers.CharField(max_length=100)
    county = serializers.CharField(max_length=100)
    postal_code = serializers.CharField(
        max_length=20, required=False, allow_blank=True, default=""
    )
    country = serializers.CharField(max_length=100, default="Kenya")
    # Optional: the subtotal the customer saw. A mismatch means prices changed under them.
    expected_subtotal = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False
    )


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product_name",
            "variant_name",
            "sku",
            "quantity",
            "unit_price",
            "line_total",
        ]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    shipping_address = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "status",
            "currency",
            "subtotal",
            "shipping_fee",
            "total_amount",
            "shipping_address",
            "items",
            "reservation_expires_at",
            "cancelled_at",
            "created_at",
        ]

    def get_shipping_address(self, order):
        return {
            "recipient_name": order.recipient_name,
            "recipient_phone": order.recipient_phone,
            "address_line_1": order.address_line_1,
            "address_line_2": order.address_line_2,
            "city": order.city,
            "county": order.county,
            "postal_code": order.postal_code,
            "country": order.country,
        }

from django.core.validators import RegexValidator
from rest_framework import serializers

from .models import Order, OrderItem
from .transitions import CUSTOMER_CANCELLABLE

phone_validator = RegexValidator(
    r"^\+?[0-9][0-9 ()-]{6,19}$",
    "Enter a valid phone number, e.g. +254 700 000 000.",
)


class CheckoutSerializer(serializers.Serializer):
    recipient_name = serializers.CharField(max_length=150)
    recipient_phone = serializers.CharField(max_length=30, validators=[phone_validator])
    address_line_1 = serializers.CharField(max_length=255)
    address_line_2 = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    city = serializers.CharField(max_length=100)
    county = serializers.CharField(max_length=100)
    postal_code = serializers.CharField(
        max_length=20, required=False, allow_blank=True, default=""
    )
    country = serializers.CharField(max_length=100, default="Kenya")
    # Optional: the subtotal the customer saw. A mismatch means prices changed under them.
    expected_subtotal = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False
    )


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product_name",
            "variant_name",
            "sku",
            "quantity",
            "unit_price",
            "line_total",
        ]


class OrderListSerializer(serializers.ModelSerializer):
    item_count = serializers.IntegerField(read_only=True)
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "status",
            "currency",
            "total_amount",
            "item_count",
            "can_cancel",
            "created_at",
        ]

    def get_can_cancel(self, order):
        return order.status in CUSTOMER_CANCELLABLE


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    shipping_address = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "status",
            "can_cancel",
            "currency",
            "subtotal",
            "shipping_fee",
            "total_amount",
            "shipping_address",
            "items",
            "reservation_expires_at",
            "cancelled_at",
            "created_at",
        ]

    def get_can_cancel(self, order):
        return order.status in CUSTOMER_CANCELLABLE

    def get_shipping_address(self, order):
        return {
            "recipient_name": order.recipient_name,
            "recipient_phone": order.recipient_phone,
            "address_line_1": order.address_line_1,
            "address_line_2": order.address_line_2,
            "city": order.city,
            "county": order.county,
            "postal_code": order.postal_code,
            "country": order.country,
        }
