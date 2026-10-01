from django.db.models.signals import post_save
from django.dispatch import receiver

from catalog.models import ProductVariant

from .models import Inventory


@receiver(post_save, sender=ProductVariant)
def create_inventory_for_new_variant(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        Inventory.objects.get_or_create(variant=instance)
