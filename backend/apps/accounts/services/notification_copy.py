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


def format_portfolio_value_change(
    *,
    change_inr: Decimal,
    total_inr: Decimal,
    direction: str,
    locale: str = DEFAULT_PUBLIC_LOCALE,
    first_name: str = "",
    weight: str = "",
) -> str:
    change = change_inr.quantize(Decimal("0.01"))
    total = total_inr.quantize(Decimal("0.01"))
    loc = normalize_preferred_locale(locale)
    name = (first_name or "there").strip()
    if direction == "down":
        if loc == "ml":
            return (
                f"ഇന്നത്തെ നിരക്ക് മാറ്റം ഏകദേശം ₹{change:,.0f} കുറച്ചു. "
                f"നിങ്ങളുടെ {weight or 'സ്വർണ്ണം'} നിങ്ങളുടേതുതന്നെ — ദീർഘകാല ദൃഷ്ടിയിൽ നോക്കാം."
            )
        return (
            f"Today's rate shift trimmed about ₹{change:,.0f} from your estimated total. "
            f"Your {weight or 'gold weight'} is unchanged — long-term holders watch trends, not daily noise."
        )
    if loc == "ml":
        return (
            f"{name}, നിങ്ങളുടെ പോർട്ട്ഫോളിയോ ഏകദേശം ₹{total:,.0f} — "
            f"₹{change:,.0f} കൂടി. നിങ്ങളുടെ ഗ്രാം മാറിയിട്ടില്ല; വിപണി മാത്രം."
        )
    return (
        f"{name}, your portfolio is worth about ₹{total:,.0f} — up ₹{change:,.0f} as gold moved. "
        f"Your grams haven't changed; the market did."
    )


def format_personal_collection_change(
    *,
    change_inr: Decimal,
    total_inr: Decimal,
    direction: str,
    locale: str = DEFAULT_PUBLIC_LOCALE,
) -> str:
    change = change_inr.quantize(Decimal("0.01"))
    total = total_inr.quantize(Decimal("0.01"))
    loc = normalize_preferred_locale(locale)
    if direction == "down":
        if loc == "ml":
            return f"നിങ്ങളുടെ personal gold records ഏകദേശം ₹{change:,.0f} കുറഞ്ഞു — സ്വർണ്ണം നിങ്ങളുടേതാണ്."
        return (
            f"Your personal gold pieces are about ₹{change:,.0f} lower in today's estimate. "
            f"The gold you recorded is still yours."
        )
    if loc == "ml":
        return f"നിങ്ങളുടെ personal holdings ഒരുമിച്ച് ₹{change:,.0f} കൂടി — ഇപ്പോൾ ഏകദേശം ₹{total:,.0f}."
    return (
        f"Your personal gold pieces are up ₹{change:,.0f} together — "
        f"now about ₹{total:,.0f} estimated."
    )


def format_holding_value_down(
    *,
    title: str,
    loss_inr: Decimal,
    new_value_inr: Decimal,
    locale: str = DEFAULT_PUBLIC_LOCALE,
) -> str:
    loss = loss_inr.quantize(Decimal("0.01"))
    total = new_value_inr.quantize(Decimal("0.01"))
    name = (title or "Your item").strip()
    loc = normalize_preferred_locale(locale)
    if loc == "ml":
        return (
            f"ഗോൾഡ് നിരക്ക് ഇന്ന് താഴ്ന്നു — {name} ഏകദേശം ₹{loss:,.0f} കുറഞ്ഞു. "
            f"ഇപ്പോൾ ഏകദേശം ₹{total:,.0f}. നിങ്ങളുടെ ഗ്രാം അതേപടി."
        )
    return (
        f"Gold dipped today — {name} is about ₹{loss:,.0f} lower in estimate "
        f"(~₹{total:,.0f} now). The weight you own is unchanged."
    )


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
