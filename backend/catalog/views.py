from django.db.models import Count, F, Min, Prefetch, Q, Sum
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from .filters import ProductFilter
from .models import Category, Product, ProductVariant
from .serializers import (
    CategorySerializer,
    ProductDetailSerializer,
    ProductListSerializer,
)


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
    ordering_fields = ["price_from", "created_at", "name"]

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
