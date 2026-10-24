from rest_framework.permissions import SAFE_METHODS, BasePermission
from .roles import ADMIN, COMMERCIAL, role_of


class StaffRolePermission(BasePermission):
    """Lecture : tout rôle interne. Écriture : Administrateur ou Commercial. Aucun rôle => refus."""
    def has_permission(self, request, view):
        role = role_of(request.user)
        if role is None:
            return False
        return request.method in SAFE_METHODS or role in (ADMIN, COMMERCIAL)


class AdminOnly(BasePermission):
    def has_permission(self, request, view):
        return role_of(request.user) == ADMIN
