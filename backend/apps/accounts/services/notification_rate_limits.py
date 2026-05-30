"""Cache-backed rate limits for promotional notification channels (spec §43)."""

from __future__ import annotations

from django.core.cache import cache

GOLD_ALERTS_PER_DAY = 3


def _gold_alerts_daily_cap() -> int:
    try:
        from apps.marketplace.models import get_or_create_ticker

        cap = int(get_or_create_ticker().max_gold_alerts_per_day or GOLD_ALERTS_PER_DAY)
        return max(1, min(cap, 20))
    except Exception:
        return GOLD_ALERTS_PER_DAY
PROMO_PER_JEWELLER_PER_WEEK = 3
FUN_PER_DAY = 1
PORTFOLIO_ALERTS_PER_DAY = 2


def _day_key(prefix: str, user_id: int) -> str:
    from django.utils import timezone

    day = timezone.now().date().isoformat()
    return f"notif_rl:{prefix}:u{user_id}:{day}"


def _week_key(prefix: str, jeweller_id: int) -> str:
    from django.utils import timezone

    iso = timezone.now().isocalendar()
    return f"notif_rl:{prefix}:j{jeweller_id}:{iso[0]}-W{iso[1]}"


def gold_alert_allowed(user_id: int | None) -> bool:
    if user_id is None:
        return True
    key = _day_key("gold", user_id)
    count = cache.get(key, 0)
    return int(count) < _gold_alerts_daily_cap()


def record_gold_alert(user_id: int | None) -> None:
    if user_id is None:
        return
    key = _day_key("gold", user_id)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=86400)


def promotional_allowed_for_jeweller(jeweller_id: int | None) -> bool:
    if jeweller_id is None:
        return True
    key = _week_key("promo_j", jeweller_id)
    count = cache.get(key, 0)
    return int(count) < PROMO_PER_JEWELLER_PER_WEEK


def record_promotional_jeweller(jeweller_id: int | None) -> None:
    if jeweller_id is None:
        return
    key = _week_key("promo_j", jeweller_id)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=604800)


def fun_notification_allowed(user_id: int) -> bool:
    key = _day_key("fun", user_id)
    return int(cache.get(key, 0)) < FUN_PER_DAY


def record_fun_notification(user_id: int) -> None:
    key = _day_key("fun", user_id)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=86400)


def _portfolio_alerts_daily_cap() -> int:
    try:
        from apps.marketplace.models import get_or_create_ticker

        cap = int(get_or_create_ticker().max_portfolio_alerts_per_day or PORTFOLIO_ALERTS_PER_DAY)
        return max(1, min(cap, 10))
    except Exception:
        return PORTFOLIO_ALERTS_PER_DAY


def portfolio_alert_allowed(user_id: int | None) -> bool:
    if user_id is None:
        return True
    key = _day_key("port", user_id)
    return int(cache.get(key, 0)) < _portfolio_alerts_daily_cap()


def record_portfolio_alert(user_id: int | None) -> None:
    if user_id is None:
        return
    key = _day_key("port", user_id)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=86400)
