"""Shared gold ornament billing tax — aligned with frontend goldBillingTax.ts."""

from __future__ import annotations

from decimal import Decimal

GST_ON_GOLD_PERCENT = Decimal("3")
GST_ON_MAKING_PERCENT = Decimal("18")
MARKETPLACE_MAKING_DISCOUNT_PERCENT = Decimal("5")

ZERO = Decimal("0")


def gst_on_gold_inr(metal_inr: Decimal) -> Decimal:
    if metal_inr <= 0:
        return ZERO
    return (metal_inr * GST_ON_GOLD_PERCENT / Decimal("100")).quantize(Decimal("0.01"))


def gst_on_making_inr(making_inr: Decimal) -> Decimal:
    if making_inr <= 0:
        return ZERO
    return (making_inr * GST_ON_MAKING_PERCENT / Decimal("100")).quantize(Decimal("0.01"))


def ornament_bill_multiplier(making_charge_percent: Decimal) -> Decimal:
    mc = making_charge_percent / Decimal("100")
    gst_gold = GST_ON_GOLD_PERCENT / Decimal("100")
    gst_mc = GST_ON_MAKING_PERCENT / Decimal("100")
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
