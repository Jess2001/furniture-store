import django_filters
from django.db.models import Exists, OuterRef, Q

from .models import Product, ProductVariant


class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    """Accepts one value or a comma-separated list: ?category=dining,bedroom"""


def split_values(raw):
    return [value.strip() for value in (raw or "").split(",") if value.strip()]


class ProductFilter(django_filters.FilterSet):
    category = CharInFilter(field_name="category__slug", lookup_expr="in")
    min_price = django_filters.NumberFilter(field_name="price_from", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="price_from", lookup_expr="lte")
    featured = django_filters.BooleanFilter(field_name="is_featured")
    in_stock = django_filters.BooleanFilter(method="filter_in_stock")
    # color and material take comma-separated lists; both are applied together in filter_queryset
    color = django_filters.CharFilter(method="skip")
    material = django_filters.CharFilter(method="skip")

    class Meta:
        model = Product
        fields = [
            "category",
            "min_price",
            "max_price",
            "featured",
            "in_stock",
            "color",
            "material",
        ]

    def skip(self, queryset, name, value):
        return queryset

    def filter_in_stock(self, queryset, name, value):
        if value:
            return queryset.filter(available_total__gt=0)
        return queryset.filter(
            Q(available_total__lte=0) | Q(available_total__isnull=True)
        )

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)

        conditions = Q()
        for field, raw in (
            ("color", self.form.cleaned_data.get("color")),
            ("material", self.form.cleaned_data.get("material")),
        ):
            values = split_values(raw)
            if values:
                any_of = Q()
                for value in values:
                    any_of |= Q(**{f"{field}__iexact": value})  # OR within one facet
                conditions &= any_of  # AND across facets

        if conditions:
            # one subquery, so color AND material must match the SAME variant
            matching = ProductVariant.objects.filter(
                conditions, product=OuterRef("pk"), is_active=True
            )
            queryset = queryset.filter(Exists(matching))
        return queryset
