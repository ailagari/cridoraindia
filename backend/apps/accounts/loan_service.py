"""Gold-backed loan quotes and requests against custodied vault holdings."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.accounts.gold_identity import MIN_TRANSFER_GRAMS
from apps.accounts.models import GoldLoanRequest
from apps.accounts.loan_otp import issue_loan_otp, verify_loan_otp
from apps.accounts.vault_service import (
    customer_loan_custodian_ids,
    customer_loan_eligible_grams,
    debit_customer_loan_collateral,
)
from apps.marketplace.loan_policy import compute_loan_amounts, jeweller_effective_ltv_percent
from apps.marketplace.models import JewellerPricingProfile, jeweller_profile_for
from apps.marketplace.pricing import reference_metal_rate_inr_per_gram_for_jeweller
from apps.marketplace.spot_prices import get_or_create_ticker, resolve_cridora_base_22k_inr

User = get_user_model()


def _loan_policy_payload(ticker) -> dict[str, str]:
    return {
        "gold_loan_ltv_min_percent": str(ticker.gold_loan_ltv_min_percent),
        "gold_loan_ltv_max_percent": str(ticker.gold_loan_ltv_max_percent),
        "gold_loan_processing_fee_percent": str(ticker.gold_loan_processing_fee_percent),
        "gold_loan_processing_fee_jeweller_share_percent": str(
            ticker.gold_loan_processing_fee_jeweller_share_percent
        ),
        "gold_loan_interest_apr_percent": str(ticker.gold_loan_interest_apr_percent),
    }


def _quote_for_jeweller(
    customer: User,
    jeweller: User,
    grams: Decimal,
    *,
    require_balance: bool = True,
) -> tuple[dict | None, str | None]:
    profile = jeweller_profile_for(jeweller)
    ticker = get_or_create_ticker()
    ltv = jeweller_effective_ltv_percent(profile, ticker)
    if ltv is None:
        return None, "This jeweller is not offering vault gold loans."

    if require_balance:
        available = customer_loan_eligible_grams(customer, jeweller)
        if grams > available:
            return None, "Insufficient eligible vault balance at this jeweller."
    else:
        available = customer_loan_eligible_grams(customer, jeweller)

    cridora_base, _ = resolve_cridora_base_22k_inr()
    ref_metal = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
    amounts = compute_loan_amounts(
        grams=grams,
        metal_inr_per_gram=ref_metal,
        ltv_percent=ltv,
        processing_fee_percent=ticker.gold_loan_processing_fee_percent,
        processing_fee_jeweller_share_percent=ticker.gold_loan_processing_fee_jeweller_share_percent,
    )

    min_g = profile.minimum_redeemable_grams
    min_str = str(min_g) if min_g is not None else ""

    eligible = available >= grams
    is_primary = bool(
        customer.default_jeweller_id and jeweller.id == customer.default_jeweller_id
    )
    out: dict[str, str] = {
        "jeweller_id": str(jeweller.id),
        "jeweller_label": jeweller.business_name or jeweller.email or "",
        "is_primary_custodian": "true" if is_primary else "false",
        "grams": str(grams),
        "eligible_vault_balance_grams": str(available),
        "eligible_for_request": "true" if eligible else "false",
        "ineligible_reason": "" if eligible else "Insufficient vault balance at this jeweller.",
        "minimum_redeemable_grams": min_str,
        "reference_metal_inr_per_gram": str(ref_metal),
        "ltv_percent": str(ltv),
        "collateral_value_inr": str(amounts["collateral_value_inr"]),
        "gross_principal_inr": str(amounts["gross_principal_inr"]),
        "processing_fee_percent": str(ticker.gold_loan_processing_fee_percent),
        "processing_fee_inr": str(amounts["processing_fee_inr"]),
        "processing_fee_jeweller_share_inr": str(amounts["processing_fee_jeweller_share_inr"]),
        "processing_fee_cridora_share_inr": str(amounts["processing_fee_cridora_share_inr"]),
        "net_disbursement_inr": str(amounts["net_disbursement_inr"]),
        "gross_loan_inr_per_gram": str(
            (amounts["gross_principal_inr"] / grams).quantize(Decimal("0.01"))
            if grams > 0
            else "0"
        ),
        "net_loan_inr_per_gram": str(
            (amounts["net_disbursement_inr"] / grams).quantize(Decimal("0.01"))
            if grams > 0
            else "0"
        ),
        "feat_loan_available": "true",
    }
    out.update(_loan_policy_payload(ticker))
    return out, None


def quote_customer_loan(
    customer: User,
    jeweller: User,
    *,
    grams: Decimal,
) -> tuple[dict | None, str | None]:
    if customer.user_type != User.CUSTOMER:
        return None, "Customers only."
    if customer.kyc_status != User.KYC_VERIFIED:
        return None, "Complete verified KYC before requesting a gold loan."
    if jeweller.user_type != User.JEWELLER or jeweller.kyc_status != User.KYC_VERIFIED:
        return None, "Verified jeweller not found."
    if jeweller.id not in customer_loan_custodian_ids(customer):
        return None, "Loans are only available against gold in your vault at this jeweller."
    if grams <= 0:
        return None, "Enter a positive gold quantity."
    if grams < MIN_TRANSFER_GRAMS:
        return None, "Below minimum gold quantity."

    profile = jeweller_profile_for(jeweller)
    min_g = profile.minimum_redeemable_grams
    if min_g is not None and grams < min_g:
        return None, f"Below minimum redeemable ({min_g} g) for this jeweller."

    return _quote_for_jeweller(customer, jeweller, grams, require_balance=True)


def customer_vault_loan_rates(customer: User) -> list[dict[str, str]]:
    """Indicative net loan ₹/g of collateral for each vault custodian (before gram amount)."""
    if customer.user_type != User.CUSTOMER:
        return []

    ticker = get_or_create_ticker()
    fee_pct = ticker.gold_loan_processing_fee_percent
    custodian_ids = customer_loan_custodian_ids(customer)
    if not custodian_ids:
        return []

    cridora_base, _ = resolve_cridora_base_22k_inr()
    jewellers = User.objects.filter(pk__in=custodian_ids, user_type=User.JEWELLER).order_by(
        "business_name", "id"
    )
    rows: list[dict[str, str]] = []
    for jeweller in jewellers:
        profile = jeweller_profile_for(jeweller)
        available = customer_loan_eligible_grams(customer, jeweller)
        ref_metal = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
        ltv = jeweller_effective_ltv_percent(profile, ticker)
        is_primary = bool(
            customer.default_jeweller_id and jeweller.id == customer.default_jeweller_id
        )
        if ltv is None or not profile.feat_loan_available:
            rows.append(
                {
                    "jeweller_id": str(jeweller.id),
                    "jeweller_label": jeweller.business_name or jeweller.email or "",
                    "is_primary_custodian": "true" if is_primary else "false",
                    "eligible_vault_balance_grams": str(available),
                    "reference_metal_inr_per_gram": str(ref_metal),
                    "ltv_percent": "",
                    "gross_loan_inr_per_gram": "",
                    "net_loan_inr_per_gram": "",
                    "processing_fee_percent": str(fee_pct),
                    "loan_available": "false",
                    "loan_unavailable_reason": (
                        "Jeweller has not enabled gold loans or has not set a loan %."
                    ),
                }
            )
            continue

        amounts = compute_loan_amounts(
            grams=Decimal("1"),
            metal_inr_per_gram=ref_metal,
            ltv_percent=ltv,
            processing_fee_percent=fee_pct,
            processing_fee_jeweller_share_percent=ticker.gold_loan_processing_fee_jeweller_share_percent,
        )
        rows.append(
            {
                "jeweller_id": str(jeweller.id),
                "jeweller_label": jeweller.business_name or jeweller.email or "",
                "is_primary_custodian": "true" if is_primary else "false",
                "eligible_vault_balance_grams": str(available),
                "reference_metal_inr_per_gram": str(ref_metal),
                "ltv_percent": str(ltv),
                "gross_loan_inr_per_gram": str(amounts["gross_principal_inr"]),
                "net_loan_inr_per_gram": str(amounts["net_disbursement_inr"]),
                "processing_fee_percent": str(fee_pct),
                "loan_available": "true",
                "loan_unavailable_reason": "",
            }
        )
    return rows


def compare_loan_offers(
    customer: User,
    *,
    grams: Decimal,
) -> tuple[dict | None, str | None]:
    if customer.user_type != User.CUSTOMER:
        return None, "Customers only."
    if grams <= 0:
        return None, "Enter a positive gold quantity."

    custodian_ids = customer_loan_custodian_ids(customer)

    ticker = get_or_create_ticker()
    profiles = (
        JewellerPricingProfile.objects.filter(
            jeweller_id__in=custodian_ids,
            feat_loan_available=True,
            jeweller__user_type=User.JEWELLER,
            jeweller__kyc_status=User.KYC_VERIFIED,
            gold_loan_ltv_percent__isnull=False,
        )
        .select_related("jeweller")
        .order_by("jeweller__business_name", "jeweller_id")
    )

    offers: list[dict[str, str]] = []
    for profile in profiles:
        jeweller = profile.jeweller
        row, err = _quote_for_jeweller(customer, jeweller, grams, require_balance=False)
        if row is None or err:
            continue
        available = Decimal(row["eligible_vault_balance_grams"])
        if available < grams:
            row["eligible_for_request"] = "false"
            row["ineligible_reason"] = "Insufficient vault balance at this jeweller."
        else:
            row["eligible_for_request"] = "true"
            row["ineligible_reason"] = ""
        offers.append(row)

    offers.sort(
        key=lambda o: Decimal(o["net_disbursement_inr"]),
        reverse=True,
    )

    eligible_offers = [o for o in offers if o["eligible_for_request"] == "true"]
    skip_compare = len(eligible_offers) == 1
    auto_jeweller_id = eligible_offers[0]["jeweller_id"] if skip_compare else ""

    if not custodian_ids:
        return {
            "grams": str(grams),
            "offer_count": "0",
            "eligible_offer_count": "0",
            "skip_compare": "false",
            "auto_selected_jeweller_id": "",
            "offers": [],
            "vault_rates": [],
            **_loan_policy_payload(ticker),
        }, None

    return {
        "grams": str(grams),
        "offer_count": str(len(offers)),
        "eligible_offer_count": str(len(eligible_offers)),
        "skip_compare": "true" if skip_compare else "false",
        "auto_selected_jeweller_id": auto_jeweller_id,
        "offers": offers,
        "vault_rates": customer_vault_loan_rates(customer),
        **_loan_policy_payload(ticker),
    }, None


@transaction.atomic
def create_pending_loan_request(
    customer: User,
    jeweller: User,
    grams: Decimal,
) -> tuple[GoldLoanRequest | None, str | None, str | None]:
    payload, err = quote_customer_loan(customer, jeweller, grams=grams)
    if err or payload is None:
        return None, err or "Could not quote loan.", None

    row = GoldLoanRequest.objects.create(
        customer=customer,
        jeweller=jeweller,
        grams=grams,
        reference_metal_inr_per_gram_snapshot=Decimal(payload["reference_metal_inr_per_gram"]),
        collateral_value_inr_snapshot=Decimal(payload["collateral_value_inr"]),
        ltv_percent_snapshot=Decimal(payload["ltv_percent"]),
        gross_principal_inr_snapshot=Decimal(payload["gross_principal_inr"]),
        processing_fee_percent_snapshot=Decimal(payload["processing_fee_percent"]),
        processing_fee_inr_snapshot=Decimal(payload["processing_fee_inr"]),
        processing_fee_jeweller_share_inr_snapshot=Decimal(
            payload["processing_fee_jeweller_share_inr"]
        ),
        net_disbursement_inr_snapshot=Decimal(payload["net_disbursement_inr"]),
        payment_method=GoldLoanRequest.PAY_CASH,
        status=GoldLoanRequest.STATUS_PENDING_JEWELLER,
    )
    code, _expires_at = issue_loan_otp(row)
    from apps.accounts.services.user_push_notify import notify_loan_pending_jeweller

    notify_loan_pending_jeweller(row)
    return row, None, code


def regenerate_customer_loan_otp(customer: User, loan_id: int) -> tuple[str | None, str | None]:
    row = GoldLoanRequest.objects.filter(
        pk=loan_id,
        customer=customer,
        status__in=(
            GoldLoanRequest.STATUS_PENDING_JEWELLER,
            GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP,
        ),
    ).first()
    if not row:
        return None, "No open loan found for this reference."
    try:
        code, _ = issue_loan_otp(row)
    except ValueError as e:
        return None, str(e)
    return code, None


def jeweller_accept_loan(jeweller: User, loan_id: int) -> tuple[bool, str]:
    with transaction.atomic():
        row = (
            GoldLoanRequest.objects.select_for_update()
            .filter(pk=loan_id, jeweller=jeweller)
            .first()
        )
        if not row:
            return False, "Loan not found."
        if row.status != GoldLoanRequest.STATUS_PENDING_JEWELLER:
            return False, "Only pending requests can be accepted."
        row.status = GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP
        row.save(update_fields=["status", "updated_at"])
        from apps.accounts.services.user_push_notify import notify_loan_awaiting_otp_customer

        notify_loan_awaiting_otp_customer(row)
    return True, ""


def jeweller_reject_loan(jeweller: User, loan_id: int) -> tuple[bool, str]:
    with transaction.atomic():
        row = (
            GoldLoanRequest.objects.select_for_update()
            .filter(pk=loan_id, jeweller=jeweller)
            .first()
        )
        if not row:
            return False, "Loan not found."
        if row.status != GoldLoanRequest.STATUS_PENDING_JEWELLER:
            return False, "Only pending requests can be rejected."
        row.status = GoldLoanRequest.STATUS_REJECTED
        row.save(update_fields=["status", "updated_at"])
    return True, ""


def jeweller_complete_loan_with_otp(
    jeweller: User, loan_id: int, otp: str
) -> tuple[GoldLoanRequest | None, str | None]:
    with transaction.atomic():
        row = (
            GoldLoanRequest.objects.select_for_update()
            .filter(pk=loan_id, jeweller=jeweller)
            .first()
        )
        if not row:
            return None, "Loan not found."
        if row.status != GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP:
            return None, "Accept the loan first, pay the customer cash, then enter their OTP."
        ok, detail = verify_loan_otp(row, otp)
        if not ok:
            return None, detail
        err_debit = debit_customer_loan_collateral(row.customer, row.jeweller, row.grams)
        if err_debit:
            return None, err_debit
        row.status = GoldLoanRequest.STATUS_DISBURSED
        row.save(update_fields=["status", "updated_at"])
    return row, None
