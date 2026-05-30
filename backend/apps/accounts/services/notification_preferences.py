"""Load and apply user notification preferences."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import NotificationPreference

User = get_user_model()
_IST = ZoneInfo("Asia/Kolkata")


def get_or_create_preferences(user: User) -> NotificationPreference:
    pref, _ = NotificationPreference.objects.get_or_create(user=user)
    return pref


def preferences_payload(pref: NotificationPreference) -> dict:
    return {
        "allow_promotional": pref.allow_promotional,
        "allow_gold_alerts": pref.allow_gold_alerts,
        "allow_portfolio_alerts": pref.allow_portfolio_alerts,
        "allow_jeweller_campaigns": pref.allow_jeweller_campaigns,
        "allow_festival_alerts": pref.allow_festival_alerts,
        "allow_push_notifications": pref.allow_push_notifications,
        "allow_sound": pref.allow_sound,
        "quiet_hours_start": pref.quiet_hours_start.isoformat() if pref.quiet_hours_start else None,
        "quiet_hours_end": pref.quiet_hours_end.isoformat() if pref.quiet_hours_end else None,
    }


def _in_quiet_hours(pref: NotificationPreference, now: datetime | None = None) -> bool:
    if not pref.quiet_hours_start or not pref.quiet_hours_end:
        return False
    now = now or timezone.now()
    local = now.astimezone(_IST).time()
    start = pref.quiet_hours_start
    end = pref.quiet_hours_end
    if start <= end:
        return start <= local <= end
    return local >= start or local <= end


def should_send_push(
    user: User,
    *,
    category: str,
    priority: str = "medium",
    notification_type: str = "",
) -> bool:
    pref = get_or_create_preferences(user)
    if not pref.allow_push_notifications:
        return False
    if _in_quiet_hours(pref) and priority != "high":
        return False
    if notification_type in ("gold_rate", "gold_hourly"):
        if not pref.allow_gold_alerts:
            return False
    if category == "security":
        return True
    if category == "promo":
        if not pref.allow_promotional:
            return False
        return pref.allow_festival_alerts or pref.allow_jeweller_campaigns
    if category == "portfolio" and not pref.allow_portfolio_alerts:
        return False
    if category == "transaction" and not pref.allow_portfolio_alerts:
        return False
    if category == "loan" and not pref.allow_portfolio_alerts:
        return False
    return True
