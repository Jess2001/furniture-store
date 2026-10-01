from django.contrib import admin
from django.core.exceptions import ValidationError
from django.forms.models import BaseInlineFormSet

from .models import Category, Product, ProductImage, ProductVariant


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductVariantFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()
        if any(self.errors):
            return
        if self.instance.status != Product.Status.ACTIVE:
            return

        has_active_variant = any(
            form.cleaned_data
            and not form.cleaned_data.get("DELETE")
            and form.cleaned_data.get("is_active")
            for form in self.forms
        )
        if not has_active_variant:
            raise ValidationError(
                "An active product needs at least one active variant. "
                "Add or activate a variant, or set the product to Inactive."
            )


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    formset = ProductVariantFormSet
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "sort_order", "is_active")
    list_editable = ("sort_order",)
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "status", "is_featured", "created_at")
    list_editable = ("is_featured",)
    list_filter = ("status", "is_featured", "category")
    list_select_related = ("category",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ProductImageInline, ProductVariantInline]

    def has_delete_permission(self, request, obj=None):
        return False
