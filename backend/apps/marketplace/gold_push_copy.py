"""Shared copy for gold price movement push notifications (Web Push + Android FCM)."""

from __future__ import annotations

from decimal import Decimal

from apps.accounts.locale_utils import DEFAULT_PUBLIC_LOCALE, normalize_preferred_locale


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
        return (
            f"ഗോൾഡ് നിരക്ക് ₹{swing:,.2f} {verb} — "
            f"₹{baseline_q:,.2f} ൽ നിന്ന് ₹{current_q:,.2f} വരെ."
        )
    verb = "increased" if delta > 0 else "decreased"
    return (
        f"Gold price has {verb} by ₹{swing:,.2f} "
        f"from {baseline_q:,.2f} to {current_q:,.2f}."
    )


def gold_rate_alert_title(locale: str = DEFAULT_PUBLIC_LOCALE) -> str:
    if normalize_preferred_locale(locale) == "ml":
        return "ഗോൾഡ് നിരക്ക് അലർട്ട്"
    return "Gold rate alert"


def gold_hourly_push_title(locale: str = DEFAULT_PUBLIC_LOCALE) -> str:
    if normalize_preferred_locale(locale) == "ml":
        return "ഗോൾഡ് നിരക്ക് അപ്‌ഡേറ്റ്"
    return "Gold price update"
