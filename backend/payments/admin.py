from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    """A read-only ledger: payments are created and settled by code, never by hand."""

    list_display = (
        "created_at",
        "order",
        "status",
        "amount",
        "phone",
        "provider_transaction_id",
    )
    list_filter = ("status", "provider", "method")
    search_fields = (
        "order__order_number",
        "provider_transaction_id",
        "phone",
        "checkout_request_id",
    )
    readonly_fields = [field.name for field in Payment._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
