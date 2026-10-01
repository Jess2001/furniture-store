from django.contrib import admin

from .models import Inventory


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ("sku", "product", "quantity", "reserved_quantity", "available")
    list_select_related = ("variant__product",)
    search_fields = ("variant__sku", "variant__product__name")
    readonly_fields = ("variant", "reserved_quantity", "updated_at")
    fields = ("variant", "quantity", "reserved_quantity", "updated_at")

    @admin.display(description="SKU", ordering="variant__sku")
    def sku(self, obj):
        return obj.variant.sku

    @admin.display(description="Product")
    def product(self, obj):
        return obj.variant.product.name

    @admin.display(description="Available")
    def available(self, obj):
        return obj.available_quantity

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
