"""Who counts as Cridora platform admin (SPA /admin APIs + Django admin users)."""

from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


def user_is_platform_admin(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "user_type", None) == User.ADMIN:
        return True
    return bool(user.is_superuser and user.is_staff)


def sync_staff_superuser_to_platform_admin(user: User) -> User:
    """Django createsuperuser leaves user_type=customer; align superusers for SPA + APIs."""
    if not (user.is_superuser and user.is_staff):
        return user
    fields: list[str] = []
    if user.user_type != User.ADMIN:
        user.user_type = User.ADMIN
        fields.append("user_type")
    if user.kyc_status != User.KYC_VERIFIED:
        user.kyc_status = User.KYC_VERIFIED
        user.kyc_verified_at = timezone.now()
        fields.extend(["kyc_status", "kyc_verified_at"])
    if fields:
        user.save(update_fields=fields)
    return user
