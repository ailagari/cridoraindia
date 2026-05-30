"""Standard notification copy for gold, portfolio, and personal holdings."""

from __future__ import annotations

from decimal import Decimal

from apps.accounts.locale_utils import DEFAULT_PUBLIC_LOCALE, normalize_preferred_locale


def format_gold_rate_standard(
    *,
    previous_rate: Decimal,
    new_rate: Decimal,
    locale: str = DEFAULT_PUBLIC_LOCALE,
) -> str:
    """Doc §16–17: old rate, new rate, difference (₹/g)."""
    prev = previous_rate.quantize(Decimal("0.01"))
    new = new_rate.quantize(Decimal("0.01"))
    delta = (new - prev).quantize(Decimal("0.01"))
    swing = abs(delta)
    loc = normalize_preferred_locale(locale)
    if loc == "ml":
        verb = "കൂടി" if delta > 0 else "കുറഞ്ഞു"
        return (
            f"സ്വർണ്ണ നിരക്ക് ₹{swing:,.2f}/g {verb} — "
            f"₹{prev:,.2f}/g → ₹{new:,.2f}/g."
        )
    verb = "increased" if delta > 0 else "decreased"
    return (
        f"Gold rate {verb} ₹{swing:,.2f}/g today — "
        f"₹{prev:,.2f}/g → ₹{new:,.2f}/g."
    )


def format_holding_gain(
    *,
    title: str,
    gain_inr: Decimal,
    new_value_inr: Decimal,
    locale: str = DEFAULT_PUBLIC_LOCALE,
) -> str:
    """Per-item personal holding gain (gain-only alerts)."""
    gain = gain_inr.quantize(Decimal("0.01"))
    total = new_value_inr.quantize(Decimal("0.01"))
    name = (title or "Your item").strip()
    loc = normalize_preferred_locale(locale)
    if loc == "ml":
        return (
            f"നിങ്ങളുടെ {name} ഏകദേശം ₹{gain:,.0f} മൂല്യം കൂടി — "
            f"ഇപ്പോൾ ഏകദേശം ₹{total:,.0f}."
        )
    return (
        f"Your {name} is now ₹{gain:,.0f} higher in estimated value — "
        f"now about ₹{total:,.0f}."
    )


def format_portfolio_gain(
    gain_inr: Decimal,
    *,
    locale: str = DEFAULT_PUBLIC_LOCALE,
) -> str:
    gain = gain_inr.quantize(Decimal("0.01"))
    loc = normalize_preferred_locale(locale)
    if loc == "ml":
        return f"നിങ്ങളുടെ പോർട്ട്ഫോളിയോയുടെ ഏകദേശ മൂല്യം ₹{gain:,.0f} കൂടി."
    return f"Your gold portfolio gained an estimated ₹{gain:,.0f} in value."


def resolve_jeweller_push_branding(jeweller_id: int) -> dict[str, str]:
    """Jeweller logo and title prefix for inbox + tray (doc §5)."""
    from django.contrib.auth import get_user_model

    from apps.marketplace.models import jeweller_profile_for

    User = get_user_model()
    jeweller = User.objects.filter(pk=jeweller_id, user_type=User.JEWELLER).first()
    if jeweller is None:
        return {"branding_label": "", "logo_url": "", "title_prefix": "Cridora"}
    name = (jeweller.business_name or jeweller.email or "Jeweller").strip()
    logo = ""
    try:
        logo = (jeweller_profile_for(jeweller).logo_url or "").strip()
    except Exception:
        logo = ""
    return {
        "branding_label": f"{name} via Cridora" if name else "",
        "logo_url": logo,
        "title_prefix": name or "Jeweller",
    }
