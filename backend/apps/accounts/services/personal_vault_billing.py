"""Personal vault bill math — metal ₹/g from invoice total with GST on gold and making."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from apps.marketplace.gold_billing import metal_inr_from_total_bill, ornament_bill_breakdown

ZERO = Decimal("0")


def _dec(raw) -> Decimal | None:
    if raw in (None, "", "null"):
        return None
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError, TypeError):
        return None


def derive_metal_rate_from_bill(
    weight_grams: Decimal,
    purchase_total_inr: Decimal,
    *,
    making_charge_percent: Decimal = ZERO,
) -> Decimal | None:
    if weight_grams <= 0 or purchase_total_inr <= 0:
        return None
    metal = metal_inr_from_total_bill(purchase_total_inr, making_charge_percent)
    if metal <= 0:
        return None
    return (metal / weight_grams).quantize(Decimal("0.0001"))


def personal_vault_bill_breakdown(
    weight_grams: Decimal,
    *,
    purchase_total_inr: Decimal | None = None,
    metal_rate_inr_per_gram: Decimal | None = None,
    making_charge_percent: Decimal = ZERO,
) -> dict[str, str] | None:
    """Return ornament bill lines and metal ₹/g for vault display and API."""
    if weight_grams <= 0:
        return None

    metal: Decimal | None = None
    rate: Decimal | None = None

    if purchase_total_inr is not None and purchase_total_inr > 0:
        metal = metal_inr_from_total_bill(purchase_total_inr, making_charge_percent)
        rate = derive_metal_rate_from_bill(
            weight_grams, purchase_total_inr, making_charge_percent=making_charge_percent
        )
    elif metal_rate_inr_per_gram is not None and metal_rate_inr_per_gram > 0:
        rate = metal_rate_inr_per_gram.quantize(Decimal("0.0001"))
        metal = (weight_grams * rate).quantize(Decimal("0.01"))

    if metal is None or metal <= 0 or rate is None:
        return None

    parts = ornament_bill_breakdown(metal, making_charge_percent=making_charge_percent)
    total_display = (
        str(purchase_total_inr.quantize(Decimal("0.01")))
        if purchase_total_inr is not None and purchase_total_inr > 0
        else str(parts["total_inr"])
    )
    return {
        "metal_inr": str(parts["metal_inr"]),
        "making_inr": str(parts["making_inr"]),
        "gst_on_gold_inr": str(parts["gst_on_gold_inr"]),
        "gst_on_making_inr": str(parts["gst_on_making_inr"]),
        "purchase_total_inr": total_display,
        "metal_rate_inr_per_gram": str(rate),
    }


def resolve_purchase_price_inr_per_gram(
    *,
    weight_grams: Decimal,
    purchase_price_inr_per_gram: Decimal | None,
    purchase_total_inr: Decimal | None,
    making_charge_percent: Decimal | None,
) -> Decimal | None:
    """Bill total wins when provided; otherwise use explicit metal ₹/g."""
    mc = making_charge_percent if making_charge_percent is not None else ZERO
    if purchase_total_inr is not None and purchase_total_inr > 0:
        return derive_metal_rate_from_bill(weight_grams, purchase_total_inr, making_charge_percent=mc)
    if purchase_price_inr_per_gram is not None and purchase_price_inr_per_gram >= 0:
        return purchase_price_inr_per_gram.quantize(Decimal("0.0001"))
    return None
