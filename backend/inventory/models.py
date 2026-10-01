import uuid

from django.db import models

from catalog.models import ProductVariant


class Inventory(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    variant = models.OneToOneField(
        ProductVariant,
        on_delete=models.CASCADE,
        related_name="inventory",
    )

    quantity = models.PositiveIntegerField(default=0)

    reserved_quantity = models.PositiveIntegerField(default=0)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Inventories"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(reserved_quantity__lte=models.F("quantity")),
                name="reserved_lte_quantity",
            ),
        ]
    @property
    def available_quantity(self):
        return self.quantity - self.reserved_quantity
    def __str__(self):
        return f"Inventory - {self.variant.sku}"
