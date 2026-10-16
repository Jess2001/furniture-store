from django.contrib import admin

from payments.models import Payment

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = [field.name for field in OrderItem._meta.fields]

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = ("created_at", "status", "amount", "phone", "provider_transaction_id")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    """Read-only: an order's status moves through the state machine, not this form."""

    list_display = ("order_number", "user", "status", "total_amount", "created_at")
    list_filter = ("status",)
    search_fields = ("order_number", "user__email")
    inlines = [OrderItemInline, PaymentInline]
    readonly_fields = [field.name for field in Order._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
