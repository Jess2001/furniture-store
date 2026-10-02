from decimal import Decimal

from django.conf import settings


def calculate_shipping(shipping, subtotal):
    """V1: one flat fee. County-based rules can grow here without touching checkout."""
    return Decimal(settings.SHIPPING_FLAT_FEE)
