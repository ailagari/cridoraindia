"""Shared gold ornament billing tax — rates from admin platform settings."""

from __future__ import annotations

from decimal import Decimal

from apps.accounts.services.platform_operational import (
    DEFAULT_GST_ON_GOLD_PERCENT,
    DEFAULT_GST_ON_MAKING_PERCENT,
    gst_on_gold_percent,
    gst_on_making_percent,
)

# Back-compat aliases (defaults only — use getters for live rates).
GST_ON_GOLD_PERCENT = DEFAULT_GST_ON_GOLD_PERCENT
GST_ON_MAKING_PERCENT = DEFAULT_GST_ON_MAKING_PERCENT
MARKETPLACE_MAKING_DISCOUNT_PERCENT = Decimal("5")

ZERO = Decimal("0")


def effective_gst_on_gold_percent() -> Decimal:
    return gst_on_gold_percent()


def effective_gst_on_making_percent() -> Decimal:
    return gst_on_making_percent()


def gst_on_gold_inr(metal_inr: Decimal) -> Decimal:
    if metal_inr <= 0:
        return ZERO
    pct = effective_gst_on_gold_percent()
    return (metal_inr * pct / Decimal("100")).quantize(Decimal("0.01"))


def gst_on_making_inr(making_inr: Decimal) -> Decimal:
    if making_inr <= 0:
        return ZERO
    pct = effective_gst_on_making_percent()
    return (making_inr * pct / Decimal("100")).quantize(Decimal("0.01"))


def ornament_bill_multiplier(making_charge_percent: Decimal) -> Decimal:
    mc = making_charge_percent / Decimal("100")
    gst_gold = effective_gst_on_gold_percent() / Decimal("100")
    gst_mc = effective_gst_on_making_percent() / Decimal("100")
    return Decimal("1") + gst_gold + mc * (Decimal("1") + gst_mc)


def metal_inr_from_total_bill(total_inr: Decimal, making_charge_percent: Decimal) -> Decimal:
    if total_inr <= 0:
        return ZERO
    mult = ornament_bill_multiplier(making_charge_percent)
    if mult <= 0:
        return ZERO
    return (total_inr / mult).quantize(Decimal("0.01"))


def ornament_bill_breakdown(
    metal_inr: Decimal,
    *,
    making_charge_percent: Decimal = ZERO,
) -> dict[str, Decimal]:
    metal = max(ZERO, metal_inr)
    making = (metal * making_charge_percent / Decimal("100")).quantize(Decimal("0.01"))
    gst_gold = gst_on_gold_inr(metal)
    gst_making = gst_on_making_inr(making)
    total = (metal + making + gst_gold + gst_making).quantize(Decimal("0.01"))
    return {
        "metal_inr": metal,
        "making_inr": making,
        "gst_on_gold_inr": gst_gold,
        "gst_on_making_inr": gst_making,
        "total_inr": total,
    }


def ornament_redemption_bill_inr(metal_inr: Decimal, making_inr: Decimal) -> dict[str, Decimal]:
    """Bill total for jewellery redemption (metal + making + GST on both)."""
    metal = max(ZERO, metal_inr)
    making = max(ZERO, making_inr)
    gst_gold = gst_on_gold_inr(metal)
    gst_making = gst_on_making_inr(making)
    total = (metal + making + gst_gold + gst_making).quantize(Decimal("0.01"))
    return {
        "metal_inr": metal,
        "making_inr": making,
        "gst_on_gold_inr": gst_gold,
        "gst_on_making_inr": gst_making,
        "total_inr": total,
    }
