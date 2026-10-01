from .stock import low_stock_count, stock_status, variant_available
from rest_framework import serializers

from .models import Category, Product, ProductImage, ProductVariant
from .stock import low_stock_count, stock_status




class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "image_url", "product_count"]


class CategorySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image_url", "alt_text", "sort_order", "is_primary"]


class VariantSummarySerializer(serializers.ModelSerializer):
    """Compact variant for product cards: enough for swatches and Add to Cart."""

    in_stock = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = ["id", "color", "color_hex", "price", "compare_at_price", "in_stock"]

    def get_in_stock(self, variant):
        return variant_available(variant) > 0


class ProductVariantSerializer(serializers.ModelSerializer):
    in_stock = serializers.SerializerMethodField()
    stock_status = serializers.SerializerMethodField()
    low_stock_count = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            "id",
            "sku",
            "name",
            "material",
            "color",
            "color_hex",
            "dimensions",
            "price",
            "compare_at_price",
            "in_stock",
            "stock_status",
            "low_stock_count",
        ]

    def get_in_stock(self, variant):
        return variant_available(variant) > 0

    def get_stock_status(self, variant):
        return stock_status(variant_available(variant))

    def get_low_stock_count(self, variant):
        return low_stock_count(variant_available(variant))


class ProductStockMixin(serializers.Serializer):
    in_stock = serializers.SerializerMethodField()
    stock_status = serializers.SerializerMethodField()
    low_stock_count = serializers.SerializerMethodField()

    def get_in_stock(self, product):
        return (product.available_total or 0) > 0

    def get_stock_status(self, product):
        return stock_status(product.available_total)

    def get_low_stock_count(self, product):
        return low_stock_count(product.available_total)


class ProductListSerializer(ProductStockMixin, serializers.ModelSerializer):
    category = CategorySummarySerializer(read_only=True)
    primary_image = serializers.SerializerMethodField()
    price_from = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    variants = VariantSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "badge",
            "category",
            "primary_image",
            "price_from",
            "in_stock",
            "stock_status",
            "low_stock_count",
            "variants",
        ]

    def get_primary_image(self, product):
        images = list(
            product.images.all()
        )  # uses the prefetched images, no extra query
        chosen = next(
            (img for img in images if img.is_primary), images[0] if images else None
        )
        return ProductImageSerializer(chosen).data if chosen else None


class ProductDetailSerializer(ProductStockMixin, serializers.ModelSerializer):
    category = CategorySummarySerializer(read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    price_from = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "badge",
            "category",
            "images",
            "variants",
            "price_from",
            "in_stock",
            "stock_status",
            "low_stock_count",
        ]
