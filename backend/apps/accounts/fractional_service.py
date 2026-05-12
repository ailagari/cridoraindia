"""Quote math for fractional gold purchase (live jeweller metal rate + GST)."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model

from apps.marketplace.models import get_or_create_ticker, jeweller_profile_for
from apps.marketplace.pricing import reference_metal_rate_inr_per_gram_for_jeweller

User = get_user_model()

GST_PERCENT = Decimal("3")  # GST on gold value; aligned with marketplace metal GST handling
MIN_TOTAL_INR = Decimal("500")
MIN_GRAMS = Decimal("0.001")


def jeweller_metal_rate_inr_per_gram(jeweller: User) -> Decimal:
    ticker = get_or_create_ticker()
    base = ticker.platform_base_inr_per_gram()
    profile = jeweller_profile_for(jeweller)
    return reference_metal_rate_inr_per_gram_for_jeweller(profile, base)


def breakdown_from_grams(grams: Decimal, rate: Decimal) -> dict[str, Decimal]:
    gold_pre = (grams * rate).quantize(Decimal("0.01"))
    gst = (gold_pre * GST_PERCENT / Decimal("100")).quantize(Decimal("0.01"))
    total = (gold_pre + gst).quantize(Decimal("0.01"))
    return {
        "grams": grams.quantize(Decimal("0.000001")),
        "gold_value_inr_pre_gst": gold_pre,
        "gst_percent": GST_PERCENT,
        "gst_inr": gst,
        "total_inr": total,
    }


def breakdown_from_total_inr(total_inr: Decimal, rate: Decimal) -> dict[str, Decimal]:
    if rate <= 0:
        raise ValueError("Invalid rate.")
    # total = gold_pre * (1 + gst/100)
    factor = Decimal("1") + GST_PERCENT / Decimal("100")
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
    if b["total_inr"] < MIN_TOTAL_INR:
        return f"Minimum order is ₹{MIN_TOTAL_INR} inclusive of GST."
    if b["grams"] < MIN_GRAMS:
        return f"Minimum gold quantity is {MIN_GRAMS} g."
    return None
