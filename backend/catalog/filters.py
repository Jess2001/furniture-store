import django_filters
from django.db.models import Exists, OuterRef, Q

from .models import Product, ProductVariant


class ProductFilter(django_filters.FilterSet):
    category = django_filters.CharFilter(field_name="category__slug")
    min_price = django_filters.NumberFilter(field_name="price_from", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="price_from", lookup_expr="lte")
    in_stock = django_filters.BooleanFilter(method="filter_in_stock")
    # color and material are applied together in filter_queryset below
    color = django_filters.CharFilter(method="skip")
    material = django_filters.CharFilter(method="skip")

    class Meta:
        model = Product
        fields = ["category", "min_price", "max_price", "in_stock", "color", "material"]

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

        lookups = {}
        if self.form.cleaned_data.get("color"):
            lookups["color__iexact"] = self.form.cleaned_data["color"]
        if self.form.cleaned_data.get("material"):
            lookups["material__iexact"] = self.form.cleaned_data["material"]

        if lookups:
            # one subquery, so color AND material must match the SAME variant
            matching = ProductVariant.objects.filter(
                product=OuterRef("pk"), is_active=True, **lookups
            )
            queryset = queryset.filter(Exists(matching))
        return queryset
