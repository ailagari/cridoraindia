"""Shared copy for gold price movement push notifications (Web Push + Android FCM)."""

from __future__ import annotations

from decimal import Decimal

from apps.accounts.locale_utils import DEFAULT_PUBLIC_LOCALE, normalize_preferred_locale
from apps.accounts.services.system_notification_render import resolve_system_notification


def format_gold_price_move_body(*, baseline: Decimal, current: Decimal, locale: str = DEFAULT_PUBLIC_LOCALE) -> str:
    """
    Example (en): Gold price has decreased by ₹10.00 from 7,505.74 to 7,495.74.
    Uses public Cridora 22K reference (₹/g).
    """
    baseline_q = baseline.quantize(Decimal("0.01"))
    current_q = current.quantize(Decimal("0.01"))
    delta = (current_q - baseline_q).quantize(Decimal("0.01"))
    swing = abs(delta)
    loc = normalize_preferred_locale(locale)
    if loc == "ml":
        verb = "കൂടി" if delta > 0 else "കുറഞ്ഞു"
    else:
        verb = "increased" if delta > 0 else "decreased"
    resolved = resolve_system_notification(
        "gold_price_move_body",
        locale=loc,
        facts={
            "direction_verb": verb,
            "swing": f"{swing:,.2f}",
            "baseline": f"{baseline_q:,.2f}",
            "current": f"{current_q:,.2f}",
        },
    )
    return resolved.body


def gold_rate_alert_title(locale: str = DEFAULT_PUBLIC_LOCALE) -> str:
    loc = normalize_preferred_locale(locale)
    return resolve_system_notification("gold_rate_alert_title", locale=loc).title


def gold_hourly_push_title(locale: str = DEFAULT_PUBLIC_LOCALE) -> str:
    loc = normalize_preferred_locale(locale)
    return resolve_system_notification("gold_hourly_push_title", locale=loc).title
