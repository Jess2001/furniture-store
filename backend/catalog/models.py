import uuid

from django.db import models


class Category(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    name = models.CharField(max_length=100)
    slug = models.SlugField(
        max_length=120,
        unique=True,
    )

    description = models.TextField(blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    image_url = models.URLField(max_length=500, blank=True)

    sort_order = models.PositiveIntegerField(default=0)
    class Meta:
        verbose_name_plural = "Categories"
        ordering = ["sort_order", "name"]
    def __str__(self):
        return self.name


class Product(models.Model):

    class Status(models.TextChoices):
        INACTIVE = "INACTIVE", "Inactive"
        ACTIVE = "ACTIVE", "Active"
        ARCHIVED = "ARCHIVED", "Archived"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )

    name = models.CharField(max_length=255)

    slug = models.SlugField(
        max_length=280,
        unique=True,
    )

    description = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.INACTIVE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_featured = models.BooleanField(default=False)

    badge = models.CharField(max_length=30, blank=True)

    class Meta:
        ordering = ["-created_at"]
    def __str__(self):
        return self.name


class ProductImage(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images",
    )

    image_url = models.URLField(max_length=500)

    alt_text = models.CharField(
        max_length=255,
        blank=True,
    )

    sort_order = models.PositiveIntegerField(default=0)

    is_primary = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["product"],
                condition=models.Q(is_primary=True),
                name="one_primary_image_per_product",
            ),
        ]

    def __str__(self):
        return f"Image for {self.product.name}"


class ProductVariant(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="variants",
    )

    sku = models.CharField(
        max_length=100,
        unique=True,
    )

    name = models.CharField(
        max_length=150,
        blank=True,
    )

    material = models.CharField(
        max_length=100,
        blank=True,
    )

    color = models.CharField(
        max_length=100,
        blank=True,
    )
    color_hex = models.CharField(
        max_length=7,
        blank=True,
    )
    dimensions = models.CharField(
        max_length=255,
        blank=True,
    )

    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    compare_at_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gte=0),
                name="variant_price_gte_zero",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gte=0),
                name="variant_price_gte_zero",
            ),
            models.CheckConstraint(
                condition=models.Q(sku__regex=r"^[A-Z0-9]+(-[A-Z0-9]+)*$"),
                name="variant_sku_format",
                violation_error_message=(
                    "SKU must use uppercase letters and digits separated by "
                    "single hyphens, e.g. OSLO-L-GRY."
                ),
            ),
            models.CheckConstraint(
                condition=models.Q(compare_at_price__isnull=True)
                | models.Q(compare_at_price__gt=models.F("price")),
                name="variant_compare_at_gt_price",
                violation_error_message="Compare-at price must be higher than the price.",
            ),
            models.CheckConstraint(
                condition=models.Q(color_hex__regex=r"^(#[0-9A-Fa-f]{6})?$"),
                name="variant_color_hex_format",
                violation_error_message="Colour must be blank or a hex code like #E3DDD1.",
            ),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.sku}"
