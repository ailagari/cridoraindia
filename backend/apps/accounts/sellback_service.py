"""Cash sellback quote & execution against fractional vault at custodian jeweller."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F

from apps.accounts.jeweller_liability_service import release_custodial_liability_for_sellback
from apps.accounts.models import GoldSellbackRequest
from apps.accounts.vault_service import customer_fractional_available, debit_customer_fractional
from apps.marketplace.models import JewellerPricingProfile, jeweller_profile_for
from apps.marketplace.pricing import (
    jeweller_buyback_display_inr_per_gram,
    reference_metal_rate_inr_per_gram_for_jeweller,
)
from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

User = get_user_model()


def quote_customer_sellback(customer: User, jeweller: User, grams: Decimal) -> tuple[dict | None, str | None]:
    """Returns (payload, error_detail)."""
    if customer.user_type != User.CUSTOMER:
        return None, "Customers only."
    if customer.kyc_status != User.KYC_VERIFIED:
        return None, "Complete verified KYC before sellback."
    if jeweller.user_type != User.JEWELLER or jeweller.kyc_status != User.KYC_VERIFIED:
        return None, "Verified jeweller not found."
    if grams <= 0:
        return None, "Enter a positive gold quantity."

    profile = jeweller_profile_for(jeweller)
    min_g = profile.minimum_redeemable_grams
    if min_g is not None and grams < min_g:
        return None, f"Below minimum redeemable ({min_g} g) for this jeweller."

    available = customer_fractional_available(customer, jeweller)
    if grams > available:
        return None, "Insufficient vault balance at this jeweller."

    cridora_base, _ = resolve_cridora_base_22k_inr()
    ref_metal = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
    buyback = jeweller_buyback_display_inr_per_gram(profile, cridora_base)
    cash = (grams * buyback).quantize(Decimal("0.01"))

    min_str = str(min_g) if min_g is not None else ""

    return {
        "jeweller_id": jeweller.id,
        "jeweller_label": jeweller.business_name or jeweller.email or "",
        "grams": str(grams),
        "vault_balance_grams": str(available),
        "minimum_redeemable_grams": min_str,
        "reference_metal_inr_per_gram": str(ref_metal),
        "buyback_inr_per_gram": str(buyback),
        "cash_estimate_inr": str(cash),
    }, None


def execute_customer_sellback(customer: User, jeweller: User, grams: Decimal) -> tuple[GoldSellbackRequest | None, str | None]:
    payload, err = quote_customer_sellback(customer, jeweller, grams)
    if err or not payload:
        return None, err or "Quote failed."

    with transaction.atomic():
        err_debit = debit_customer_fractional(customer, jeweller, grams)
        if err_debit:
            return None, err_debit
        row = GoldSellbackRequest.objects.create(
            customer=customer,
            jeweller=jeweller,
            grams=grams,
            reference_metal_inr_per_gram_snapshot=Decimal(payload["reference_metal_inr_per_gram"]),
            buyback_inr_per_gram_snapshot=Decimal(payload["buyback_inr_per_gram"]),
            cash_estimate_inr=Decimal(payload["cash_estimate_inr"]),
            status=GoldSellbackRequest.STATUS_COMPLETED,
        )
        release_custodial_liability_for_sellback(jeweller, customer, grams, row)

        JewellerPricingProfile.objects.filter(jeweller=jeweller).update(
            metric_total_redeemed_gold_grams=F("metric_total_redeemed_gold_grams") + grams
        )
        return row, None
