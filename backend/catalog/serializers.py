from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from .models import Category, Product, ProductImage, ProductVariant


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description"]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image_url", "alt_text", "sort_order", "is_primary"]


class ProductVariantSerializer(serializers.ModelSerializer):
    available_quantity = serializers.SerializerMethodField()
    in_stock = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            "id",
            "sku",
            "name",
            "material",
            "color",
            "dimensions",
            "price",
            "available_quantity",
            "in_stock",
        ]

    def get_available_quantity(self, variant):
        try:
            return variant.inventory.available_quantity
        except ObjectDoesNotExist:
            return 0

    def get_in_stock(self, variant):
        return self.get_available_quantity(variant) > 0


class ProductListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    primary_image = serializers.SerializerMethodField()
    price_from = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "category",
            "primary_image",
            "price_from",
            "in_stock",
        ]

    def get_primary_image(self, product):
        images = list(
            product.images.all()
        )  # uses the prefetched images, no extra query
        chosen = next(
            (img for img in images if img.is_primary), images[0] if images else None
        )
        return ProductImageSerializer(chosen).data if chosen else None

    def get_in_stock(self, product):
        return (product.available_total or 0) > 0


class ProductDetailSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    price_from = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "category",
            "images",
            "variants",
            "price_from",
            "in_stock",
        ]

    def get_in_stock(self, product):
        return (product.available_total or 0) > 0
