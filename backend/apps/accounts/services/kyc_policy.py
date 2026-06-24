"""Customer KYC requirement — admin-toggleable via platform feature flags."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response

from django.contrib.auth import get_user_model

from apps.accounts.platform_features import is_feature_enabled

User = get_user_model()


def customer_kyc_required() -> bool:
    return is_feature_enabled("customer_kyc_required")


def customer_kyc_satisfied(user) -> bool:
    if user.user_type != User.CUSTOMER:
        return user.kyc_status == User.KYC_VERIFIED
    if not customer_kyc_required():
        return True
    return user.kyc_status == User.KYC_VERIFIED


def require_customer_kyc(user, detail: str = "Complete KYC before this action.") -> Response | None:
    if customer_kyc_satisfied(user):
        return None
    return Response({"detail": detail}, status=status.HTTP_403_FORBIDDEN)
