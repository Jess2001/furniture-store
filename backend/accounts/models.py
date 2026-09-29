import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from .managers import UserManager

class User(AbstractUser):
    class Role(models.TextChoices):
        CUSTOMER = "CUSTOMER", "Customer"
        STAFF = "STAFF", "Staff"
        ADMIN = "ADMIN", "Admin"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    username = None

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    def __str__(self):
        return self.email


class Address(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="addresses",
    )

    label = models.CharField(max_length=50)

    recipient_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30)

    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(
        max_length=255,
        blank=True,
    )

    city = models.CharField(max_length=100)
    county = models.CharField(max_length=100)
    postal_code = models.CharField(
        max_length=20,
        blank=True,
    )
    country = models.CharField(
        max_length=100,
        default="Kenya",
    )

    is_default = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.label} - {self.city}"
