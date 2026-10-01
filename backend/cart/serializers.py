from decimal import Decimal

from rest_framework import serializers

from .models import CartItem
from .services import item_status


class AddItemSerializer(serializers.Serializer):
    variant_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, default=1)


class UpdateItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)


class CartItemSerializer(serializers.ModelSerializer):
    variant = serializers.SerializerMethodField()
    product = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()
    problem = serializers.SerializerMethodField()
    max_available = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            "id",
            "quantity",
            "variant",
            "product",
            "line_total",
            "problem",
            "max_available",
        ]

    def get_variant(self, item):
        variant = item.variant
        return {
            "id": variant.id,
            "sku": variant.sku,
            "name": variant.name,
            "color": variant.color,
            "color_hex": variant.color_hex,
            "price": f"{variant.price:.2f}",
            "compare_at_price": (
                f"{variant.compare_at_price:.2f}" if variant.compare_at_price else None
            ),
        }

    def get_product(self, item):
        product = item.variant.product
        images = list(product.images.all())
        chosen = next(
            (i for i in images if i.is_primary), images[0] if images else None
        )
        return {
            "name": product.name,
            "slug": product.slug,
            "image_url": chosen.image_url if chosen else None,
        }

    def get_line_total(self, item):
        return f"{item.variant.price * item.quantity:.2f}"

    def get_problem(self, item):
        return item_status(item)[0]

    def get_max_available(self, item):
        return item_status(item)[1]


class CartSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    items = CartItemSerializer(many=True)
    item_count = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    has_problems = serializers.SerializerMethodField()

    def get_item_count(self, cart):
        return sum(item.quantity for item in cart.items.all())

    def get_subtotal(self, cart):
        total = sum(
            (item.variant.price * item.quantity for item in cart.items.all()),
            Decimal("0"),
        )
        return f"{total:.2f}"

    def get_has_problems(self, cart):
        return any(item_status(item)[0] for item in cart.items.all())
