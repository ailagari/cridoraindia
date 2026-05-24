"""Platform commercial ledger (spread fees) — separate from operational gram ledger."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model

from .models import (
    FractionalGoldPurchase,
    PlatformCommercialLedgerEntry,
    VaultProductRedemption,
)
from .services.platform_operational import fractional_markup_percent

User = get_user_model()


def spread_fee_inr_for_purchase(purchase: FractionalGoldPurchase) -> Decimal:
    """Platform markup portion of gold value (Cridora spread on fractional buy)."""
    markup_pct = fractional_markup_percent()
    if markup_pct <= 0:
        return Decimal("0")
    fee = (purchase.gold_value_inr_pre_gst * markup_pct / Decimal("100")).quantize(
        Decimal("0.01")
    )
    return max(fee, Decimal("0"))


def record_spread_fee_on_fractional_confirm(
    purchase: FractionalGoldPurchase,
) -> PlatformCommercialLedgerEntry | None:
    if purchase.jeweller.user_type != User.JEWELLER:
        return None
    if PlatformCommercialLedgerEntry.objects.filter(
        fractional_purchase_id=purchase.pk,
        kind=PlatformCommercialLedgerEntry.KIND_SPREAD_FEE,
    ).exists():
        return None
    amount = spread_fee_inr_for_purchase(purchase)
    if amount <= 0:
        return None
    return PlatformCommercialLedgerEntry.objects.create(
        jeweller=purchase.jeweller,
        fractional_purchase=purchase,
        amount_inr=amount,
        kind=PlatformCommercialLedgerEntry.KIND_SPREAD_FEE,
        status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
    )


def record_cross_platform_fee_on_redemption(
    redemption: VaultProductRedemption,
) -> PlatformCommercialLedgerEntry | None:
    if redemption.jeweller.user_type != User.JEWELLER:
        return None
    if PlatformCommercialLedgerEntry.objects.filter(
        vault_product_redemption_id=redemption.pk,
        kind=PlatformCommercialLedgerEntry.KIND_CROSS_PLATFORM_FEE,
    ).exists():
        return None
    amount = redemption.cross_platform_fee_inr or Decimal("0")
    if amount <= 0:
        return None
    return PlatformCommercialLedgerEntry.objects.create(
        jeweller=redemption.jeweller,
        vault_product_redemption=redemption,
        amount_inr=amount,
        kind=PlatformCommercialLedgerEntry.KIND_CROSS_PLATFORM_FEE,
        status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
    )
