from rest_framework.permissions import BasePermission

from accounts.models import User


class IsStaffRole(BasePermission):
    """Allows store staff and admins."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role in (User.Role.STAFF, User.Role.ADMIN)
        )


class IsAdminRole(BasePermission):
    """Allows admins only."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == User.Role.ADMIN)
