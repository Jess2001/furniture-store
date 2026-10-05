from decimal import Decimal

from django.db.models import Count, F, Max, Min, Prefetch, Q, Sum
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .filters import ProductFilter
from .models import Category, Product, ProductVariant
from .serializers import (
    CategorySerializer,
    ProductDetailSerializer,
    ProductListSerializer,
)


def money(value):
    """Prices go over the wire as strings like "50000.00", never as floats."""
    return None if value is None else f"{Decimal(str(value)):.2f}"


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    pagination_class = None
    lookup_field = "slug"

    def get_queryset(self):
        return (
            Category.objects.filter(is_active=True)
            .annotate(
                product_count=Count(
                    "products",
                    filter=Q(products__status=Product.Status.ACTIVE),
                )
            )
            .order_by("sort_order", "name")
        )


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    authentication_classes = []
    lookup_field = "slug"
    filterset_class = ProductFilter
    search_fields = ["name", "description", "category__name"]
    ordering_fields = ["price_from", "created_at", "name", "is_featured"]

    def get_queryset(self):
        return (
            Product.objects.filter(
                status=Product.Status.ACTIVE,
                category__is_active=True,
            )
            .select_related("category")
            .prefetch_related(
                "images",
                Prefetch(
                    "variants",
                    queryset=ProductVariant.objects.filter(is_active=True)
                    .select_related("inventory")
                    .order_by("price", "sku"),
                ),
            )
            .annotate(
                price_from=Min("variants__price", filter=Q(variants__is_active=True)),
                available_total=Sum(
                    F("variants__inventory__quantity")
                    - F("variants__inventory__reserved_quantity"),
                    filter=Q(variants__is_active=True),
                ),
            )
            .order_by("-created_at", "id")
        )

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        # tie-breaker so equal prices/names never shuffle between pages
        return queryset.order_by(*queryset.query.order_by, "id")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    @action(detail=False, methods=["get"], pagination_class=None)
    def facets(self, request):
        """What the shop sidebar can offer: price range, materials, colours and stock counts."""
        variants = ProductVariant.objects.filter(
            is_active=True,
            product__status=Product.Status.ACTIVE,
            product__category__is_active=True,
        )
        price = variants.aggregate(min=Min("price"), max=Max("price"))
        materials = (
            variants.exclude(material="")
            .values("material")
            .annotate(count=Count("product", distinct=True))
            .order_by("-count", "material")
        )
        colors = (
            variants.exclude(color="")
            .values("color", "color_hex")
            .annotate(count=Count("product", distinct=True))
            .order_by("-count", "color")
        )
        return Response(
            {
                "price": {"min": money(price["min"]), "max": money(price["max"])},
                "materials": [
                    {"name": m["material"], "count": m["count"]} for m in materials
                ],
                "colors": [
                    {"name": c["color"], "hex": c["color_hex"], "count": c["count"]}
                    for c in colors
                ],
                "in_stock_count": self.get_queryset()
                .filter(available_total__gt=0)
                .count(),
            }
        )
