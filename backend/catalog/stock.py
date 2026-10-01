from django.core.exceptions import ObjectDoesNotExist

LOW_STOCK_THRESHOLD = 5


def stock_status(available):
    available = available or 0
    if available <= 0:
        return "out_of_stock"
    if available <= LOW_STOCK_THRESHOLD:
        return "low_stock"
    return "in_stock"


def low_stock_count(available):
    """The exact number is only revealed when stock is low."""
    available = available or 0
    return available if 0 < available <= LOW_STOCK_THRESHOLD else None


def variant_available(variant):
    """Units that can still be sold: quantity minus reserved (0 if no inventory row)."""
    try:
        return variant.inventory.available_quantity
    except ObjectDoesNotExist:
        return 0
