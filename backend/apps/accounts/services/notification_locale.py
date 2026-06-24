"""Resolve en/ml for automated gold and portfolio notifications."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.accounts.locale_utils import DEFAULT_PUBLIC_LOCALE, normalize_preferred_locale

User = get_user_model()


def engagement_malayalam_enabled() -> bool:
    from apps.marketplace.models import get_or_create_ticker

    return bool(get_or_create_ticker().engagement_malayalam_enabled)


def _raw_user_preferred_locale(user: User) -> str:
    """Best-effort locale from push subscription, native token, or client session."""
    from apps.accounts.models import ClientDeviceSession, NativePushToken, WebPushSubscription

    sub = (
        WebPushSubscription.objects.filter(user=user)
        .order_by("-created_at")
        .values_list("preferred_locale", flat=True)
        .first()
    )
    if sub:
        loc = normalize_preferred_locale(sub)
        if loc == "ml":
            return "ml"

    token = (
        NativePushToken.objects.filter(user=user)
        .order_by("-updated_at")
        .values_list("preferred_locale", flat=True)
        .first()
    )
    if token:
        loc = normalize_preferred_locale(token)
        if loc == "ml":
            return "ml"

    session = (
        ClientDeviceSession.objects.filter(user=user)
        .order_by("-last_seen_at")
        .values_list("preferred_locale", flat=True)
        .first()
    )
    if session:
        loc = normalize_preferred_locale(session)
        if loc == "ml":
            return "ml"

    return DEFAULT_PUBLIC_LOCALE


def resolve_user_notification_locale(user: User | None) -> str:
    """
    English unless admin enabled Malayalam and the user's device prefers ml.
    """
    if user is None or not engagement_malayalam_enabled():
        return DEFAULT_PUBLIC_LOCALE
    return _raw_user_preferred_locale(user)


def localized_broadcast_payloads(
    *,
    en: dict,
    ml: dict | None = None,
) -> dict[str, dict]:
    """Build locale map for tray broadcasts; omit Malayalam when admin toggle is off."""
    out: dict[str, dict] = {DEFAULT_PUBLIC_LOCALE: en}
    if engagement_malayalam_enabled() and ml:
        out["ml"] = ml
    return out
