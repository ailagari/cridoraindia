"""Gold-backed loan quotes and requests against custodied vault holdings."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.accounts.gold_identity import MIN_TRANSFER_GRAMS
from apps.accounts.models import (
    GoldLoanRepayment,
    GoldLoanRepaymentRequest,
    GoldLoanRequest,
)
from apps.accounts.loan_otp import issue_loan_otp, verify_loan_otp
from apps.accounts.loan_repayment_otp import (
    issue_loan_repayment_otp,
    verify_loan_repayment_otp,
)
from apps.accounts.vault_service import (
    customer_loan_custodian_ids,
    customer_loan_collateral_locked_grams,
    customer_loan_eligible_grams,
    debit_customer_loan_collateral,
    lock_customer_loan_collateral,
    release_customer_loan_collateral,
)
from apps.marketplace.loan_policy import (
    compute_loan_amounts,
    jeweller_effective_ltv_percent,
    validate_loan_term_months,
)
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
        "gold_loan_max_term_months": str(ticker.gold_loan_max_term_months),
    }


def _serialize_loan_account(row: GoldLoanRequest) -> dict[str, str]:
    outstanding = row.principal_outstanding_inr
    return {
        "id": row.id,
        "reference": f"LN-{row.id}",
        "status": row.status,
        "jeweller_id": str(row.jeweller_id),
        "jeweller_label": row.jeweller.business_name or row.jeweller.email or "",
        "grams": str(row.grams),
        "collateral_fractional_grams": str(row.collateral_fractional_grams),
        "collateral_deposit_grams": str(row.collateral_deposit_grams),
        "collateral_locked_grams": str(row.collateral_fractional_grams + row.collateral_deposit_grams),
        "collateral_value_inr": str(row.collateral_value_inr_snapshot),
        "gross_principal_inr": str(row.gross_principal_inr_snapshot),
        "principal_paid_inr": str(row.principal_paid_inr),
        "principal_outstanding_inr": str(outstanding),
        "net_disbursement_inr": str(row.net_disbursement_inr_snapshot),
        "term_months": str(row.term_months),
        "disbursed_at": row.disbursed_at.isoformat() if row.disbursed_at else "",
        "due_at": row.due_at.isoformat() if row.due_at else "",
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
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
        locked = customer_loan_collateral_locked_grams(customer, jeweller)
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
                    "loan_collateral_locked_grams": str(locked),
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
                "loan_collateral_locked_grams": str(locked),
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
    *,
    term_months: int = 12,
) -> tuple[GoldLoanRequest | None, str | None, str | None]:
    ticker = get_or_create_ticker()
    term_err = validate_loan_term_months(term_months, ticker)
    if term_err:
        return None, term_err, None

    payload, err = quote_customer_loan(customer, jeweller, grams=grams)
    if err or payload is None:
        return None, err or "Could not quote loan.", None

    frac_g, dep_g, lock_err = lock_customer_loan_collateral(customer, jeweller, grams)
    if lock_err:
        return None, lock_err, None

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
        term_months=term_months,
        collateral_fractional_grams=frac_g,
        collateral_deposit_grams=dep_g,
        status=GoldLoanRequest.STATUS_PENDING_JEWELLER,
    )
    code, _expires_at = issue_loan_otp(row)
    from apps.accounts.services.user_push_notify import notify_loan_pending_jeweller

    notify_loan_pending_jeweller(row)
    return row, None, code


def _release_loan_collateral_if_any(row: GoldLoanRequest) -> str | None:
    frac = row.collateral_fractional_grams
    dep = row.collateral_deposit_grams
    if frac + dep <= 0:
        return None
    err = release_customer_loan_collateral(row.customer, row.jeweller, frac, dep)
    if err:
        return err
    row.collateral_fractional_grams = Decimal("0")
    row.collateral_deposit_grams = Decimal("0")
    row.save(update_fields=["collateral_fractional_grams", "collateral_deposit_grams", "updated_at"])
    return None


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
        err = _release_loan_collateral_if_any(row)
        if err:
            return False, err
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
        locked = row.collateral_fractional_grams + row.collateral_deposit_grams
        if locked < row.grams:
            err_debit = debit_customer_loan_collateral(row.customer, row.jeweller, row.grams)
            if err_debit:
                return None, err_debit
        now = timezone.now()
        row.status = GoldLoanRequest.STATUS_DISBURSED
        row.disbursed_at = now
        row.due_at = now + timedelta(days=30 * int(row.term_months))
        row.save(update_fields=["status", "disbursed_at", "due_at", "updated_at"])
        from apps.accounts.jeweller_revenue_service import record_loan_processing_fee_revenue

        record_loan_processing_fee_revenue(row)
    return row, None


def customer_active_loans(customer: User) -> list[GoldLoanRequest]:
    return list(
        GoldLoanRequest.objects.filter(
            customer=customer,
            status=GoldLoanRequest.STATUS_DISBURSED,
        )
        .select_related("jeweller")
        .order_by("-disbursed_at", "-id")
    )


def _open_repayment_statuses() -> tuple[str, ...]:
    return (
        GoldLoanRepaymentRequest.STATUS_PENDING_PAYMENT,
        GoldLoanRepaymentRequest.STATUS_SIGNAL_RECEIVED,
        GoldLoanRepaymentRequest.STATUS_PENDING_JEWELLER,
        GoldLoanRepaymentRequest.STATUS_PENDING_REVIEW,
        GoldLoanRepaymentRequest.STATUS_NEEDS_MANUAL_VERIFICATION,
        GoldLoanRepaymentRequest.STATUS_ACCEPTED_AWAITING_OTP,
    )


def _serialize_repayment_request(req: GoldLoanRepaymentRequest) -> dict[str, str]:
    loan = req.loan
    jl = loan.jeweller
    otp_row = getattr(req, "settlement_otp", None)
    exp = otp_row.expires_at.isoformat() if otp_row else ""
    return {
        "id": req.id,
        "reference": f"LRP-{req.id}",
        "loan_id": loan.pk,
        "loan_reference": f"LN-{loan.pk}",
        "amount_inr": str(req.amount_inr),
        "status": req.status,
        "payment_method": req.payment_method,
        "order_reference": req.order_reference,
        "reconciliation_score": str(req.reconciliation_score or ""),
        "jeweller_id": str(loan.jeweller_id),
        "jeweller_label": jl.business_name or jl.email or "",
        "otp_expires_at": exp,
        "created_at": req.created_at.isoformat(),
        "updated_at": req.updated_at.isoformat(),
    }


def customer_open_loan_repayments(customer: User) -> list[GoldLoanRepaymentRequest]:
    return list(
        GoldLoanRepaymentRequest.objects.filter(
            loan__customer=customer,
            status__in=_open_repayment_statuses(),
        )
        .select_related("loan", "loan__jeweller", "settlement_otp")
        .order_by("-updated_at")[:30]
    )


def customer_loan_accounts(customer: User) -> dict:
    """Open requests + active disbursed loans for customer dashboard."""
    open_statuses = (
        GoldLoanRequest.STATUS_PENDING_JEWELLER,
        GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP,
    )
    pending = list(
        GoldLoanRequest.objects.filter(customer=customer, status__in=open_statuses)
        .select_related("jeweller", "settlement_otp")
        .order_by("-updated_at")[:20]
    )
    active = customer_active_loans(customer)
    pending_repayments = customer_open_loan_repayments(customer)
    return {
        "pending": pending,
        "active": active,
        "pending_repayments": pending_repayments,
        "gold_loan_max_term_months": str(get_or_create_ticker().gold_loan_max_term_months),
    }


@transaction.atomic
def _apply_loan_repayment(
    row: GoldLoanRequest, amount_inr: Decimal
) -> tuple[GoldLoanRepayment | None, dict | None, str | None]:
    outstanding = row.principal_outstanding_inr
    if amount_inr > outstanding:
        return None, None, f"Amount exceeds outstanding principal (₹{outstanding})."
    row.principal_paid_inr += amount_inr
    after = row.principal_outstanding_inr
    rep = GoldLoanRepayment.objects.create(
        loan=row,
        amount_inr=amount_inr,
        principal_after_inr=after,
    )
    if after <= 0:
        err = _release_loan_collateral_if_any(row)
        if err:
            return None, None, err
        row.status = GoldLoanRequest.STATUS_REPAID
        row.save(
            update_fields=[
                "principal_paid_inr",
                "status",
                "collateral_fractional_grams",
                "collateral_deposit_grams",
                "updated_at",
            ]
        )
    else:
        row.save(update_fields=["principal_paid_inr", "updated_at"])
    payload = _serialize_loan_account(row)
    payload["repayment_amount_inr"] = str(amount_inr)
    return rep, payload, None


@transaction.atomic
def customer_initiate_loan_repayment(
    customer: User,
    loan_id: int,
    amount_inr: Decimal,
    *,
    payment_method: str = GoldLoanRepaymentRequest.PAY_CASH,
) -> tuple[GoldLoanRepaymentRequest | None, str | None, str | None]:
    """Create pending repayment; cash uses OTP, UPI uses reconciliation engine."""
    if amount_inr <= 0:
        return None, None, "Enter a positive repayment amount."
    row = (
        GoldLoanRequest.objects.select_for_update()
        .filter(pk=loan_id, customer=customer)
        .select_related("jeweller")
        .first()
    )
    if not row:
        return None, None, "Loan not found."
    if row.status != GoldLoanRequest.STATUS_DISBURSED:
        return None, None, "Only active disbursed loans accept repayment."
    outstanding = row.principal_outstanding_inr
    if amount_inr > outstanding:
        return None, None, f"Amount exceeds outstanding principal (₹{outstanding})."
    existing = (
        GoldLoanRepaymentRequest.objects.select_for_update()
        .filter(loan=row, status__in=_open_repayment_statuses())
        .exists()
    )
    if existing:
        return None, None, "Finish or cancel your open repayment request before starting another."
    pay = (payment_method or GoldLoanRepaymentRequest.PAY_CASH).strip().lower()
    if pay not in (GoldLoanRepaymentRequest.PAY_CASH, GoldLoanRepaymentRequest.PAY_UPI):
        return None, None, "payment_method must be cash or upi."
    if pay == GoldLoanRepaymentRequest.PAY_UPI:
        from apps.accounts.services.fractional_upi import (
            default_payment_expires_at,
            jeweller_upi_vpa,
        )
        from apps.accounts.services.payment_reconciliation.signals import loan_payment_note_for

        vpa = jeweller_upi_vpa(row.jeweller)
        if not vpa:
            return None, None, "Jeweller has not configured UPI for online repayment."
        req = GoldLoanRepaymentRequest.objects.create(
            loan=row,
            amount_inr=amount_inr,
            payment_method=GoldLoanRepaymentRequest.PAY_UPI,
            status=GoldLoanRepaymentRequest.STATUS_PENDING_PAYMENT,
            payee_upi_vpa=vpa,
            payment_expires_at=default_payment_expires_at(),
        )
        req.payment_note = loan_payment_note_for(req.pk)
        req.save(update_fields=["payment_note", "updated_at"])
    else:
        req = GoldLoanRepaymentRequest.objects.create(
            loan=row,
            amount_inr=amount_inr,
            payment_method=GoldLoanRepaymentRequest.PAY_CASH,
            status=GoldLoanRepaymentRequest.STATUS_PENDING_JEWELLER,
        )
        code, _expires_at = issue_loan_repayment_otp(req)
    from apps.accounts.services.user_push_notify import notify_loan_repayment_pending_jeweller

    notify_loan_repayment_pending_jeweller(req)
    if pay == GoldLoanRepaymentRequest.PAY_UPI:
        return req, None, None
    return req, code, None


def regenerate_customer_loan_repayment_otp(
    customer: User, repayment_id: int
) -> tuple[str | None, str | None]:
    req = (
        GoldLoanRepaymentRequest.objects.filter(
            pk=repayment_id,
            loan__customer=customer,
            status__in=_open_repayment_statuses(),
        )
        .first()
    )
    if not req:
        return None, "No open repayment found for this reference."
    try:
        code, _ = issue_loan_repayment_otp(req)
    except ValueError as e:
        return None, str(e)
    return code, None


def customer_cancel_loan_repayment(
    customer: User, repayment_id: int
) -> tuple[bool, str]:
    with transaction.atomic():
        req = (
            GoldLoanRepaymentRequest.objects.select_for_update()
            .filter(pk=repayment_id, loan__customer=customer)
            .first()
        )
        if not req:
            return False, "Repayment request not found."
        if req.status not in _open_repayment_statuses():
            return False, "Only open repayment requests can be cancelled."
        req.status = GoldLoanRepaymentRequest.STATUS_CANCELLED
        req.save(update_fields=["status", "updated_at"])
    return True, ""


def jeweller_open_loan_repayments(jeweller: User) -> list[GoldLoanRepaymentRequest]:
    return list(
        GoldLoanRepaymentRequest.objects.filter(
            loan__jeweller=jeweller,
            status__in=_open_repayment_statuses(),
        )
        .select_related("loan", "loan__customer", "settlement_otp")
        .order_by("-updated_at")[:100]
    )


def jeweller_accept_loan_repayment(jeweller: User, repayment_id: int) -> tuple[bool, str]:
    with transaction.atomic():
        req = (
            GoldLoanRepaymentRequest.objects.select_for_update()
            .filter(pk=repayment_id, loan__jeweller=jeweller)
            .select_related("loan")
            .first()
        )
        if not req:
            return False, "Repayment request not found."
        if req.status != GoldLoanRepaymentRequest.STATUS_PENDING_JEWELLER:
            return False, "Only pending repayments can be accepted."
        req.status = GoldLoanRepaymentRequest.STATUS_ACCEPTED_AWAITING_OTP
        req.save(update_fields=["status", "updated_at"])
        from apps.accounts.services.user_push_notify import (
            notify_loan_repayment_awaiting_otp_customer,
        )

        notify_loan_repayment_awaiting_otp_customer(req)
    return True, ""


def jeweller_reject_loan_repayment(jeweller: User, repayment_id: int) -> tuple[bool, str]:
    with transaction.atomic():
        req = (
            GoldLoanRepaymentRequest.objects.select_for_update()
            .filter(pk=repayment_id, loan__jeweller=jeweller)
            .first()
        )
        if not req:
            return False, "Repayment request not found."
        if req.status != GoldLoanRepaymentRequest.STATUS_PENDING_JEWELLER:
            return False, "Only pending repayments can be rejected."
        req.status = GoldLoanRepaymentRequest.STATUS_REJECTED
        req.save(update_fields=["status", "updated_at"])
    return True, ""


def jeweller_approve_loan_repayment_upi(
    jeweller: User, repayment_id: int
) -> tuple[GoldLoanRepaymentRequest | None, dict | None, str | None]:
    from apps.accounts.services.payment_reconciliation.loan_engine import (
        _apply_loan_repayment_confirmed,
    )
    from apps.accounts.services.payment_reconciliation.signals import (
        capture_loan_jeweller_confirmation_signal,
    )

    with transaction.atomic():
        req = (
            GoldLoanRepaymentRequest.objects.select_for_update()
            .filter(pk=repayment_id, loan__jeweller=jeweller)
            .select_related("loan")
            .first()
        )
        if not req:
            return None, None, "Repayment request not found."
        if req.payment_method != GoldLoanRepaymentRequest.PAY_UPI:
            return None, None, "Not a UPI repayment."
        if req.status == GoldLoanRepaymentRequest.STATUS_COMPLETED:
            loan = req.loan
            return req, {"loan_id": loan.pk, "status": loan.status}, None
        if req.status not in (
            GoldLoanRepaymentRequest.STATUS_PENDING_REVIEW,
            GoldLoanRepaymentRequest.STATUS_NEEDS_MANUAL_VERIFICATION,
            GoldLoanRepaymentRequest.STATUS_SIGNAL_RECEIVED,
            GoldLoanRepaymentRequest.STATUS_PENDING_PAYMENT,
        ):
            return None, None, "Repayment is not awaiting UPI approval."
        capture_loan_jeweller_confirmation_signal(req)
        _apply_loan_repayment_confirmed(req, jeweller)
        loan = GoldLoanRequest.objects.get(pk=req.loan_id)
        return req, {"loan_id": loan.pk, "status": loan.status}, None


def jeweller_complete_loan_repayment_with_otp(
    jeweller: User, repayment_id: int, otp: str
) -> tuple[GoldLoanRepaymentRequest | None, dict | None, str | None]:
    with transaction.atomic():
        req = (
            GoldLoanRepaymentRequest.objects.select_for_update()
            .filter(pk=repayment_id, loan__jeweller=jeweller)
            .select_related("loan", "loan__customer", "loan__jeweller")
            .first()
        )
        if not req:
            return None, None, "Repayment request not found."
        if req.status != GoldLoanRepaymentRequest.STATUS_ACCEPTED_AWAITING_OTP:
            return None, None, (
                "Accept the repayment first, collect cash from the customer, then enter their OTP."
            )
        ok, detail = verify_loan_repayment_otp(req, otp)
        if not ok:
            return None, None, detail
        loan = (
            GoldLoanRequest.objects.select_for_update()
            .filter(pk=req.loan_id)
            .first()
        )
        if not loan or loan.status != GoldLoanRequest.STATUS_DISBURSED:
            return None, None, "Loan is no longer active."
        _rep, loan_payload, err = _apply_loan_repayment(loan, req.amount_inr)
        if err:
            return None, None, err
        req.status = GoldLoanRepaymentRequest.STATUS_COMPLETED
        req.save(update_fields=["status", "updated_at"])
    return req, loan_payload, None
