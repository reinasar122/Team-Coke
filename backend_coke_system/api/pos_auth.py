"""Signed POS login tokens for endpoints containing customer order details."""

from django.conf import settings
from django.core import signing
from django.db.models import Q
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission

from .models import RoleAccessibility, User


TOKEN_SALT = "api.pos-session"
ADMIN_ROLES = {"admin", "administrator", "super admin"}


def is_pos_admin(user):
    return bool(user.role and user.role.name.strip().lower() in ADMIN_ROLES)


def password_stamp(user):
    return salted_hmac("api.pos-session.password", user.password).hexdigest()


def create_pos_session_token(user):
    return signing.dumps(
        {"user_id": user.pk, "password_stamp": password_stamp(user)},
        salt=TOKEN_SALT,
    )


class POSSessionAuthentication(BaseAuthentication):
    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts:
            return None
        if len(parts) != 2 or parts[0].lower() != b"bearer":
            raise AuthenticationFailed("Please sign in again to load mobile purchases.")
        try:
            payload = signing.loads(
                parts[1].decode("ascii"), salt=TOKEN_SALT,
                max_age=settings.POS_SESSION_MAX_AGE,
            )
            user = User.objects.select_related("role", "warehouse").get(pk=payload["user_id"])
            if not constant_time_compare(payload["password_stamp"], password_stamp(user)):
                raise signing.BadSignature()
        except (signing.BadSignature, User.DoesNotExist, KeyError, TypeError, ValueError, UnicodeError):
            raise AuthenticationFailed("Please sign in again to load mobile purchases.")
        if not user.is_active or not user.role or (not is_pos_admin(user) and not user.is_approved):
            raise AuthenticationFailed("Your account no longer has access. Please sign in again.")
        return user, payload

    def authenticate_header(self, request):
        return "Bearer"


class CanViewMobileOrders(BasePermission):
    message = "Your role does not have access to mobile purchases."

    def has_permission(self, request, view):
        if not request.auth:
            return False
        return RoleAccessibility.objects.filter(
            role_id=request.user.role_id, submenu="Trading",
        ).filter(Q(full=True) | Q(view=True)).exists()


class CanProcessMobileOrders(BasePermission):
    message = "Your role does not have permission to process mobile purchases."

    def has_permission(self, request, view):
        if not request.auth:
            return False
        return RoleAccessibility.objects.filter(
            role_id=request.user.role_id, submenu="Trading",
        ).filter(Q(full=True) | Q(edit=True)).exists()
