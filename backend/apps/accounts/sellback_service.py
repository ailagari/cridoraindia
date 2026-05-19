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
from apps.accounts.services.fractional_upi import default_payment_expires_at
from apps.accounts.services.sellback_upi import normalize_upi_vpa, payout_note_for
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


def settle_sellback(row: GoldSellbackRequest) -> str | None:
    """Debit vault and release liability after cash OTP or UPI confirmation."""
    customer = row.customer
    jeweller = row.jeweller
    grams = row.grams
    err_debit = debit_customer_fractional(customer, jeweller, grams)
    if err_debit:
        return err_debit

    row.status = GoldSellbackRequest.STATUS_COMPLETED
    row.save(update_fields=["status", "updated_at"])

    release_custodial_liability_for_sellback(jeweller, customer, grams, row)

    JewellerPricingProfile.objects.filter(jeweller=jeweller).update(
        metric_total_redeemed_gold_grams=F("metric_total_redeemed_gold_grams") + grams
    )
    return None


def create_pending_sellback_with_otp(
    customer: User,
    jeweller: User,
    grams: Decimal,
    *,
    payment_method: str = GoldSellbackRequest.PAY_CASH,
    payout_upi_vpa: str = "",
) -> tuple[GoldSellbackRequest | None, str | None, str | None]:
    """Creates pending request; cash path also issues OTP."""
    payload, err = quote_customer_sellback(customer, jeweller, grams=grams)
    if err or not payload:
        return None, err or "Quote failed.", None

    method = payment_method if payment_method in (
        GoldSellbackRequest.PAY_CASH,
        GoldSellbackRequest.PAY_UPI,
    ) else GoldSellbackRequest.PAY_CASH

    payout_vpa = ""
    if method == GoldSellbackRequest.PAY_UPI:
        normalized = normalize_upi_vpa(payout_upi_vpa)
        if not normalized:
            return None, "Enter a valid UPI ID for payout (name@bank).", None
        payout_vpa = normalized

    with transaction.atomic():
        row = GoldSellbackRequest.objects.create(
            customer=customer,
            jeweller=jeweller,
            grams=grams,
            reference_metal_inr_per_gram_snapshot=Decimal(payload["reference_metal_inr_per_gram"]),
            buyback_inr_per_gram_snapshot=Decimal(payload["buyback_inr_per_gram"]),
            cash_estimate_inr=Decimal(payload["cash_estimate_inr"]),
            payment_method=method,
            payout_upi_vpa=payout_vpa,
            status=GoldSellbackRequest.STATUS_PENDING_JEWELLER,
        )
        row.payment_note = payout_note_for(row.id)
        row.save(update_fields=["payment_note", "updated_at"])

        if method == GoldSellbackRequest.PAY_UPI:
            customer.payout_upi_vpa = payout_vpa
            customer.save(update_fields=["payout_upi_vpa"])
            return row, None, None

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
        updates = ["status", "updated_at"]
        if row.payment_method == GoldSellbackRequest.PAY_UPI:
            row.payout_expires_at = default_payment_expires_at()
            updates.append("payout_expires_at")
        row.save(update_fields=updates)
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
            return None, "Accept the sellback first, pay the customer, then settle."
        if row.payment_method == GoldSellbackRequest.PAY_UPI:
            return None, "This is a UPI payout sellback. Pay the customer in your UPI app and submit the UTR."
        ok, detail = verify_sellback_otp(row, otp)
        if not ok:
            return None, detail

        err_settle = settle_sellback(row)
        if err_settle:
            return None, err_settle

    return row, None


def customer_confirm_sellback_utr(
    customer: User, sellback_id: int
) -> tuple[GoldSellbackRequest | None, str | None]:
    from apps.accounts.services.sellback_upi import confirm_utr_for_customer

    with transaction.atomic():
        row = (
            GoldSellbackRequest.objects.select_for_update()
            .filter(pk=sellback_id, customer=customer)
            .first()
        )
        if not row:
            return None, "Sellback not found."
        ok, detail = confirm_utr_for_customer(row, customer)
        if not ok:
            return None, detail

        err_settle = settle_sellback(row)
        if err_settle:
            return None, err_settle

    return row, None
