"""Quote math for fractional gold purchase (live jeweller metal rate + GST)."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model

from apps.marketplace.models import jeweller_profile_for
from apps.marketplace.pricing import reference_metal_rate_inr_per_gram_for_jeweller
from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

from .services.platform_operational import fractional_markup_percent, gst_on_gold_percent

User = get_user_model()

MIN_GRAMS = Decimal("0.001")  # gold deposit intake floor (not fractional purchase minimum)


def jeweller_metal_rate_inr_per_gram(jeweller: User) -> Decimal:
    cridora_base, _ = resolve_cridora_base_22k_inr()
    profile = jeweller_profile_for(jeweller)
    return reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)


def platform_metal_rate_inr_per_gram() -> Decimal:
    """Cridora 22K reference from admin ticker & fees (not jeweller board spread)."""
    base, _ = resolve_cridora_base_22k_inr()
    return base.quantize(Decimal("0.01"))


def apply_fractional_platform_markup(base_rate: Decimal) -> Decimal:
    markup = fractional_markup_percent()
    if markup <= 0:
        return base_rate.quantize(Decimal("0.01"))
    factor = Decimal("1") + markup / Decimal("100")
    return (base_rate * factor).quantize(Decimal("0.01"))


def fractional_metal_rate_inr_per_gram(_jeweller: User | None = None) -> Decimal:
    """Customer fractional buy rate: platform ticker reference + admin markup."""
    return apply_fractional_platform_markup(platform_metal_rate_inr_per_gram())


def breakdown_from_grams(grams: Decimal, rate: Decimal) -> dict[str, Decimal]:
    gold_pre = (grams * rate).quantize(Decimal("0.01"))
    gst_pct = gst_on_gold_percent()
    gst = (gold_pre * gst_pct / Decimal("100")).quantize(Decimal("0.01"))
    total = (gold_pre + gst).quantize(Decimal("0.01"))
    return {
        "grams": grams.quantize(Decimal("0.000001")),
        "gold_value_inr_pre_gst": gold_pre,
        "gst_percent": gst_pct,
        "gst_inr": gst,
        "total_inr": total,
    }


def breakdown_from_total_inr(total_inr: Decimal, rate: Decimal) -> dict[str, Decimal]:
    if rate <= 0:
        raise ValueError("Invalid rate.")
    gst_pct = gst_on_gold_percent()
    factor = Decimal("1") + gst_pct / Decimal("100")
    gold_pre = (total_inr / factor).quantize(Decimal("0.01"))
    grams = (gold_pre / rate).quantize(Decimal("0.000001"))
    gst = (total_inr - gold_pre).quantize(Decimal("0.01"))
    out = breakdown_from_grams(grams, rate)
    # keep total matching input
    out["total_inr"] = total_inr.quantize(Decimal("0.01"))
    out["gst_inr"] = gst
    out["gold_value_inr_pre_gst"] = gold_pre
    return out


def validate_minimums(b: dict[str, Decimal]) -> str | None:
    if b["total_inr"] <= 0:
        return "Enter a positive amount in ₹."
    if b["grams"] <= 0:
        return "Enter a positive gold quantity."
    return None
