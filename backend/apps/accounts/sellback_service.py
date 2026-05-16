"""Cash sellback quote & jeweller-verified settlement against fractional vault."""

from __future__ import annotations

from decimal import ROUND_DOWN, Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F

from apps.accounts.gold_identity import MIN_TRANSFER_GRAMS, parse_cash_inr
from apps.accounts.jeweller_liability_service import release_custodial_liability_for_sellback
from apps.accounts.models import GoldSellbackRequest
from apps.accounts.sellback_otp import issue_sellback_otp, verify_sellback_otp
from apps.accounts.vault_service import customer_fractional_available, debit_customer_fractional
from apps.marketplace.models import JewellerPricingProfile, jeweller_profile_for
from apps.marketplace.pricing import (
    jeweller_buyback_display_inr_per_gram,
    reference_metal_rate_inr_per_gram_for_jeweller,
)
from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

User = get_user_model()


def quote_customer_sellback(
    customer: User,
    jeweller: User,
    *,
    grams: Decimal | None = None,
    cash_inr: Decimal | None = None,
) -> tuple[dict | None, str | None]:
    """Quote from grams or target cash (cash path derives grams from buyback ₹/g)."""
    if customer.user_type != User.CUSTOMER:
        return None, "Customers only."
    if customer.kyc_status != User.KYC_VERIFIED:
        return None, "Complete verified KYC before sellback."
    if jeweller.user_type != User.JEWELLER or jeweller.kyc_status != User.KYC_VERIFIED:
        return None, "Verified jeweller not found."

    if (grams is None) == (cash_inr is None):
        return None, "Provide either grams or cash_inr (not both)."

    profile = jeweller_profile_for(jeweller)
    min_g = profile.minimum_redeemable_grams
    available = customer_fractional_available(customer, jeweller)
    cridora_base, _ = resolve_cridora_base_22k_inr()
    ref_metal = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
    buyback = jeweller_buyback_display_inr_per_gram(profile, cridora_base)

    if cash_inr is not None:
        grams_calc = (cash_inr / buyback).quantize(Decimal("0.000001"), rounding=ROUND_DOWN)
        if grams_calc < MIN_TRANSFER_GRAMS:
            return None, "That cash amount rounds to less than the minimum gold quantity."
        if min_g is not None and grams_calc < min_g:
            return None, f"Below minimum redeemable ({min_g} g) for this jeweller."
        max_cash = (available * buyback).quantize(Decimal("0.01"))
        if cash_inr > max_cash:
            return None, "Cash amount exceeds what your vault can cover at this buyback rate."
        grams = grams_calc
    else:
        assert grams is not None
        if grams <= 0:
            return None, "Enter a positive gold quantity."
        if min_g is not None and grams < min_g:
            return None, f"Below minimum redeemable ({min_g} g) for this jeweller."
        if grams > available:
            return None, "Insufficient vault balance at this jeweller."

    cash = (grams * buyback).quantize(Decimal("0.01"))
    min_str = str(min_g) if min_g is not None else ""
    mode = "cash_inr" if cash_inr is not None else "grams"

    out: dict[str, str] = {
        "jeweller_id": jeweller.id,
        "jeweller_label": jeweller.business_name or jeweller.email or "",
        "grams": str(grams),
        "vault_balance_grams": str(available),
        "minimum_redeemable_grams": min_str,
        "reference_metal_inr_per_gram": str(ref_metal),
        "buyback_inr_per_gram": str(buyback),
        "cash_estimate_inr": str(cash),
        "quote_input_mode": mode,
    }
    if cash_inr is not None:
        out["requested_cash_inr"] = str(cash_inr.quantize(Decimal("0.01")))
    return out, None


def create_pending_sellback_with_otp(
    customer: User, jeweller: User, grams: Decimal
) -> tuple[GoldSellbackRequest | None, str | None, str | None]:
    """Creates pending request + OTP; vault balance unchanged until jeweller verifies OTP."""
    payload, err = quote_customer_sellback(customer, jeweller, grams=grams)
    if err or not payload:
        return None, err or "Quote failed.", None

    with transaction.atomic():
        row = GoldSellbackRequest.objects.create(
            customer=customer,
            jeweller=jeweller,
            grams=grams,
            reference_metal_inr_per_gram_snapshot=Decimal(payload["reference_metal_inr_per_gram"]),
            buyback_inr_per_gram_snapshot=Decimal(payload["buyback_inr_per_gram"]),
            cash_estimate_inr=Decimal(payload["cash_estimate_inr"]),
            status=GoldSellbackRequest.STATUS_PENDING_JEWELLER,
        )
        code, _expires_at = issue_sellback_otp(row)
    return row, None, code


def regenerate_customer_sellback_otp(customer: User, sellback_id: int) -> tuple[str | None, str | None]:
    row = GoldSellbackRequest.objects.filter(
        pk=sellback_id,
        customer=customer,
        status=GoldSellbackRequest.STATUS_PENDING_JEWELLER,
    ).first()
    if not row:
        return None, "No pending sellback found for this reference."
    try:
        code, _ = issue_sellback_otp(row)
    except ValueError as e:
        return None, str(e)
    return code, None


def jeweller_accept_sellback(jeweller: User, sellback_id: int) -> tuple[bool, str]:
    with transaction.atomic():
        row = (
            GoldSellbackRequest.objects.select_for_update()
            .filter(pk=sellback_id, jeweller=jeweller)
            .first()
        )
        if not row:
            return False, "Sellback not found."
        if row.status != GoldSellbackRequest.STATUS_PENDING_JEWELLER:
            return False, "Only pending requests can be accepted."
        row.status = GoldSellbackRequest.STATUS_ACCEPTED_AWAITING_OTP
        row.save(update_fields=["status", "updated_at"])
    return True, ""


def jeweller_reject_sellback(jeweller: User, sellback_id: int) -> tuple[bool, str]:
    with transaction.atomic():
        row = (
            GoldSellbackRequest.objects.select_for_update()
            .filter(pk=sellback_id, jeweller=jeweller)
            .first()
        )
        if not row:
            return False, "Sellback not found."
        if row.status != GoldSellbackRequest.STATUS_PENDING_JEWELLER:
            return False, "Only pending requests can be rejected."
        row.status = GoldSellbackRequest.STATUS_REJECTED
        row.save(update_fields=["status", "updated_at"])
    return True, ""


def jeweller_complete_sellback_with_otp(
    jeweller: User, sellback_id: int, otp: str
) -> tuple[GoldSellbackRequest | None, str | None]:
    """After offline payout: verify OTP, debit vault, release liability."""
    with transaction.atomic():
        row = (
            GoldSellbackRequest.objects.select_for_update()
            .filter(pk=sellback_id, jeweller=jeweller)
            .first()
        )
        if not row:
            return None, "Sellback not found."
        if row.status != GoldSellbackRequest.STATUS_ACCEPTED_AWAITING_OTP:
            return None, "Accept the sellback first, pay the customer offline, then enter their OTP."
        ok, detail = verify_sellback_otp(row, otp)
        if not ok:
            return None, detail

        customer = row.customer
        grams = row.grams
        err_debit = debit_customer_fractional(customer, jeweller, grams)
        if err_debit:
            return None, err_debit

        row.status = GoldSellbackRequest.STATUS_COMPLETED
        row.save(update_fields=["status", "updated_at"])

        release_custodial_liability_for_sellback(jeweller, customer, grams, row)

        JewellerPricingProfile.objects.filter(jeweller=jeweller).update(
            metric_total_redeemed_gold_grams=F("metric_total_redeemed_gold_grams") + grams
        )

    return row, None
