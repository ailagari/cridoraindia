"""Vault redemption checkout — INR totals aligned with frontend `marketplacePricing.ts`."""

from __future__ import annotations

from decimal import ROUND_UP, Decimal

from django.contrib.auth import get_user_model
from django.db.models import Sum

from apps.accounts.models import VaultHolding

from .models import (
    JewellerPricingProfile,
    MarketplaceProduct,
    get_or_create_ticker,
    jeweller_profile_for,
)
from .pricing import (
    gold_metal_value_inr,
    gold_rate_inr_per_gram,
    markup_for_product,
    stone_component_inr,
)
from .spot_prices import resolve_cridora_base_22k_inr

User = get_user_model()

_DISCOUNT_ON_MAKING = Decimal("0.05")
_GST_GOLD = Decimal("0.03")
_GST_MAKING = Decimal("0.18")


def customer_has_vault_holdings_at_jeweller(
    customer: User | None, jeweller_id: int
) -> bool:
    """True if the customer holds any vaulted gold (fractional, deposit, or scheme) at this custodian."""
    if not customer or customer.user_type != User.CUSTOMER:
        return False
    total = (
        VaultHolding.objects.filter(
            vault__owner=customer, vault__custodian_id=jeweller_id
        ).aggregate(t=Sum("balance_grams"))["t"]
        or Decimal("0")
    )
    return total > 0


def _effective_making_percent(product: MarketplaceProduct, same_store: bool) -> Decimal:
    cross = product.making_charge_percent or Decimal("0")
    if not same_store:
        return cross
    if product.same_store_making_charge_percent is not None:
        return product.same_store_making_charge_percent
    return cross


def _effective_making_per_gram(product: MarketplaceProduct, same_store: bool) -> Decimal:
    cross = product.making_charge_per_gram or Decimal("0")
    if not same_store:
        return cross
    if product.same_store_making_charge_per_gram is not None:
        return product.same_store_making_charge_per_gram
    return cross


def _raw_making_inr(
    product: MarketplaceProduct, metal_val: Decimal, same_store: bool
) -> Decimal:
    if product.making_charge_mode == MarketplaceProduct.MAKING_PERCENT_OF_METAL:
        pct = _effective_making_percent(product, same_store) / Decimal("100")
        return (metal_val * pct).quantize(Decimal("0.01"))
    per_g = _effective_making_per_gram(product, same_store)
    return (product.gold_weight_grams * per_g).quantize(Decimal("0.01"))


def resolve_listing_metal_rate_inr(
    product: MarketplaceProduct,
    profile: JewellerPricingProfile | None = None,
) -> Decimal:
    """Listing metal ₹/g with fallbacks when live spot or board resolves to zero."""
    profile = profile or jeweller_profile_for(product.jeweller)
    cridora_base, _ = resolve_cridora_base_22k_inr()
    rate = gold_rate_inr_per_gram(product, profile, cridora_base)
    if rate > 0:
        return rate
    manual = product.manual_gold_rate_inr_per_gram
    if manual is not None and manual > 0:
        return manual.quantize(Decimal("0.01"))
    legacy = profile.manual_gold_rate_inr_per_gram
    if legacy is not None and legacy > 0:
        return legacy.quantize(Decimal("0.01"))
    platform = get_or_create_ticker().platform_base_inr_per_gram()
    if platform > 0:
        m = markup_for_product(product, profile) / Decimal("100")
        return (platform * (Decimal("1") + m)).quantize(Decimal("0.01"))
    return Decimal("0")


def _jeweller_line_parts(
    product: MarketplaceProduct, customer: User | None
) -> tuple[Decimal, Decimal, Decimal, Decimal, Decimal, bool]:
    """gold_line, making, gst_gold_full, gst_making, discount, same_store."""
    profile = jeweller_profile_for(product.jeweller)
    metal_rate = resolve_listing_metal_rate_inr(product, profile)
    metal_val = gold_metal_value_inr(product, metal_rate)
    stone = stone_component_inr(product)
    gold_line = metal_val + stone

    same_store = bool(
        customer
        and customer.user_type == User.CUSTOMER
        and customer.default_jeweller_id == product.jeweller_id
    )

    raw_making = _raw_making_inr(product, metal_val, same_store)
    discount = (raw_making * _DISCOUNT_ON_MAKING).quantize(Decimal("0.01"))
    making = (raw_making - discount).quantize(Decimal("0.01"))
    gst_gold_full = (gold_line * _GST_GOLD).quantize(Decimal("0.01"))
    gst_making = (making * _GST_MAKING).quantize(Decimal("0.01"))
    return gold_line, making, gst_gold_full, gst_making, discount, same_store


def checkout_totals_with_vault(
    product: MarketplaceProduct,
    customer: User | None,
    vault_grams: Decimal,
) -> dict[str, Decimal | bool]:
    """
    Checkout totals when applying up to `vault_grams` from the customer's vault at the listing jeweller.
    GST on gold is waived on the metal portion paid from vault (already taxed when vaulted).
    """
    gold_line, making, gst_gold_full, gst_making, _discount, same_store = _jeweller_line_parts(
        product, customer
    )
    metal_rate = resolve_listing_metal_rate_inr(product)

    full_jeweller_subtotal = (gold_line + making + gst_gold_full + gst_making).quantize(
        Decimal("0.01")
    )

    cross = Decimal("0")
    if product.is_x_redeem and not customer_has_vault_holdings_at_jeweller(
        customer, product.jeweller_id
    ):
        cross = get_or_create_ticker().cross_platform_fee_inr or Decimal("0")
        if cross < 0:
            cross = Decimal("0")

    final_invoice = (full_jeweller_subtotal + cross).quantize(Decimal("0.01"))

    grams = max(Decimal("0"), vault_grams)
    raw_vault_inr = (grams * metal_rate).quantize(Decimal("0.01"))
    vault_metal_credit = min(raw_vault_inr, gold_line)
    gst_on_gold = ((gold_line - vault_metal_credit) * _GST_GOLD).quantize(Decimal("0.01"))
    gst_on_gold_saved = max(Decimal("0"), gst_gold_full - gst_on_gold)
    vault_value_offset = min(raw_vault_inr, final_invoice)
    cash_payable = max(
        Decimal("0"), final_invoice - vault_value_offset - gst_on_gold_saved
    ).quantize(Decimal("0.01"))

    return {
        "final_invoice_inr": final_invoice,
        "metal_rate_inr_per_gram": metal_rate,
        "jeweller_subtotal_inr": full_jeweller_subtotal,
        "same_store": same_store,
        "cross_platform_fee_inr": cross,
        "vault_metal_credit_inr": vault_metal_credit,
        "gst_on_gold_saved_inr": gst_on_gold_saved,
        "cash_payable_inr": cash_payable,
        "grams_applied": grams,
    }


def invoice_totals_for_vault_redemption(
    product: MarketplaceProduct, customer: User | None
) -> tuple[Decimal, Decimal, Decimal, bool, Decimal]:
    """Cash-only invoice (no vault grams applied)."""
    totals = checkout_totals_with_vault(product, customer, Decimal("0"))
    return (
        totals["final_invoice_inr"],
        totals["metal_rate_inr_per_gram"],
        totals["jeweller_subtotal_inr"],
        totals["same_store"],
        totals["cross_platform_fee_inr"],
    )


def grams_to_charge_for_invoice(final_invoice_inr: Decimal, metal_rate_inr: Decimal) -> Decimal:
    if metal_rate_inr <= 0:
        return Decimal("0")
    return (final_invoice_inr / metal_rate_inr).quantize(
        Decimal("0.000001"), rounding=ROUND_UP
    )


def suggested_vault_grams_for_full_order(
    product: MarketplaceProduct, customer: User | None, vault_available: Decimal
) -> Decimal:
    """Grams needed to bring cash payable to zero (iterative, matches frontend)."""
    cash = checkout_totals_with_vault(product, customer, Decimal("0"))
    metal_rate = cash["metal_rate_inr_per_gram"]
    if metal_rate <= 0 or vault_available <= 0:
        return Decimal("0")
    grams = grams_to_charge_for_invoice(cash["final_invoice_inr"], metal_rate)
    for _ in range(10):
        bd = checkout_totals_with_vault(product, customer, grams)
        if bd["cash_payable_inr"] <= Decimal("0.01"):
            return min(grams, vault_available)
        grams += (bd["cash_payable_inr"] / metal_rate).quantize(Decimal("0.000001"))
    return min(grams, vault_available)
