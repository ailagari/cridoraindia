"""Unified jeweller purchase desk: all customer↔jeweller flows in one paginated feed."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model

from apps.accounts.corridorapay_views import OPEN_STATUSES as CP_OPEN
from apps.accounts.fractional_reconciliation_views import (
    JEWELLER_APPROVED_STATUSES,
    JEWELLER_CANCELLED_STATUSES,
    JEWELLER_PENDING_STATUSES,
    _enrich_jeweller_desk_row,
)
from apps.accounts.models import (
    CridoraPayBill,
    FractionalGoldPurchase,
    GoldDepositIntake,
    GoldLoanRequest,
    GoldSellbackRequest,
    PlatformCommercialLedgerEntry,
    VaultProductRedemption,
)
from apps.accounts.platform_commercial_service import spread_fee_inr_for_purchase

User = get_user_model()

BUCKET_PENDING = "pending"
BUCKET_COMPLETED = "completed"
BUCKET_CANCELLED = "cancelled"

FRACTIONAL_UPI_REVIEW = (
    FractionalGoldPurchase.PENDING_REVIEW,
)

SELLBACK_PENDING = (
    GoldSellbackRequest.STATUS_PENDING_JEWELLER,
    GoldSellbackRequest.STATUS_ACCEPTED_AWAITING_OTP,
    GoldSellbackRequest.STATUS_AWAITING_UTR_VERIFY,
)
SELLBACK_COMPLETED = (GoldSellbackRequest.STATUS_COMPLETED,)
SELLBACK_CANCELLED = (
    GoldSellbackRequest.STATUS_REJECTED,
    GoldSellbackRequest.STATUS_CANCELLED,
)

LOAN_PENDING = (
    GoldLoanRequest.STATUS_PENDING_JEWELLER,
    GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP,
)
LOAN_COMPLETED = (GoldLoanRequest.STATUS_DISBURSED, GoldLoanRequest.STATUS_REPAID)
LOAN_CANCELLED = (GoldLoanRequest.STATUS_REJECTED, GoldLoanRequest.STATUS_CANCELLED)

CP_CANCELLED = (
    CridoraPayBill.STATUS_CANCELLED,
    CridoraPayBill.STATUS_EXPIRED,
)


TRANSACTION_TYPE_LABELS = {
    "fractional": "Fractional gold",
    "deposit": "Gold deposit",
    "ornament_redemption": "Jewellery purchase",
    "cridorapay": "CridoraPay bill",
    "sellback": "Sellback",
    "loan_fee": "Loan processing fee",
}

METHOD_LABELS = {
    "upi": "UPI",
    "counter": "Counter",
    "vault": "Vault",
    "cash": "Cash",
    "mixed": "Mixed",
}


def _type_label(transaction_type: str) -> str:
    return TRANSACTION_TYPE_LABELS.get(transaction_type, transaction_type.replace("_", " ").title())


def _method_label(method: str) -> str:
    if not method or method == "—":
        return "—"
    return METHOD_LABELS.get(method, method.replace("_", " ").title())


def _customer_dict(user: User) -> dict[str, str]:
    return {
        "name": f"{user.first_name} {user.last_name}".strip(),
        "email": user.email or "",
        "member_id": user.cridora_member_id or "",
    }


def _build_row(
    *,
    source_model: str,
    source_id: int,
    reference: str,
    transaction_type: str,
    customer: User,
    amount_inr: str,
    grams: str,
    payment_method: str,
    otp_utr: str,
    status_raw: str,
    status_label: str,
    platform_fee_inr: str,
    created_at: str,
    completed_at: str | None,
    detail: dict[str, Any],
    actions: list[str],
    type_label: str = "",
    method_label: str = "",
) -> dict[str, Any]:
    return {
        "id": f"{source_model}:{source_id}",
        "source_model": source_model,
        "source_id": source_id,
        "reference": reference,
        "transaction_type": transaction_type,
        "type_label": type_label or _type_label(transaction_type),
        "customer": _customer_dict(customer),
        "amount_inr": amount_inr,
        "grams": grams,
        "payment_method": payment_method,
        "method_label": method_label or _method_label(payment_method),
        "otp_utr": otp_utr,
        "status": status_label,
        "status_raw": status_raw,
        "platform_fee_inr": platform_fee_inr,
        "created_at": created_at,
        "completed_at": completed_at,
        "detail": detail,
        "actions": actions,
    }


def _ledger_fee_map(jeweller: User) -> dict[tuple[str, int], Decimal]:
    out: dict[tuple[str, int], Decimal] = {}
    for e in PlatformCommercialLedgerEntry.objects.filter(jeweller=jeweller).select_related(
        "fractional_purchase", "vault_product_redemption"
    ):
        if e.fractional_purchase_id:
            out[("fractional", e.fractional_purchase_id)] = e.amount_inr
        elif getattr(e, "vault_product_redemption_id", None):
            out[("ornament_redemption", e.vault_product_redemption_id)] = e.amount_inr
    return out


def _fractional_actions(p: FractionalGoldPurchase) -> list[str]:
    if p.status == FractionalGoldPurchase.AWAITING_COUNTER:
        return ["verify_otp"]
    if p.status in FRACTIONAL_UPI_REVIEW:
        return ["confirm_upi", "reject_upi"]
    return []


def _fractional_payment_method(p: FractionalGoldPurchase) -> str:
    return p.payment_method or "—"


def _fractional_otp_utr(p: FractionalGoldPurchase) -> str:
    if p.payment_method == FractionalGoldPurchase.PAY_UPI:
        return p.upi_utr or "—"
    return "—"


def _fractional_platform_fee(p: FractionalGoldPurchase, ledger: dict[tuple[str, int], Decimal]) -> str:
    fee = ledger.get(("fractional", p.pk))
    if fee is not None:
        return str(fee)
    return str(spread_fee_inr_for_purchase(p))


def _map_fractional(
    p: FractionalGoldPurchase,
    ledger: dict[tuple[str, int], Decimal],
) -> dict[str, Any]:
    enriched = _enrich_jeweller_desk_row(p)
    return _build_row(
        source_model="fractional_gold_purchase",
        source_id=p.pk,
        reference=enriched.get("reference") or f"FR-{p.pk}",
        transaction_type="fractional",
        customer=p.customer,
        amount_inr=str(p.total_inr),
        grams=str(p.grams),
        payment_method=_fractional_payment_method(p),
        otp_utr=_fractional_otp_utr(p),
        status_raw=p.status,
        status_label=p.get_status_display(),
        platform_fee_inr=_fractional_platform_fee(p, ledger),
        created_at=p.created_at.isoformat(),
        completed_at=p.jeweller_verified_at.isoformat() if p.jeweller_verified_at else None,
        detail={
            "order_reference": enriched.get("order_reference"),
            "metal_rate_inr_per_gram": str(p.metal_rate_inr_per_gram),
            "reconciliation_score": enriched.get("reconciliation_score"),
            "reconciliation_flags": enriched.get("reconciliation_flags") or {},
            "otp_expires_at": enriched.get("otp_expires_at"),
            "payment_note": p.payment_note or "",
            "upi_utr": p.upi_utr or "",
            "proof_file_url": p.upi_proof_file.url if p.upi_proof_file else "",
            "upi_rejection_count": p.upi_rejection_count,
            "upi_last_rejection_remark": p.upi_last_rejection_remark or "",
            "upi_fraud_reported": p.upi_fraud_reported,
        },
        actions=_fractional_actions(p),
    )


def _deposit_actions(d: GoldDepositIntake) -> list[str]:
    if d.status == GoldDepositIntake.AWAITING_CUSTOMER_OTP:
        return ["verify_deposit_otp"]
    return []


def _map_deposit(d: GoldDepositIntake) -> dict[str, Any]:
    otp_expires = None
    try:
        otp_expires = d.counter_otp.expires_at.isoformat()
    except Exception:
        pass
    return _build_row(
        source_model="gold_deposit_intake",
        source_id=d.pk,
        reference=f"GD-{d.pk}",
        transaction_type="deposit",
        customer=d.customer,
        amount_inr=str(d.estimated_value_inr),
        grams=str(d.grams),
        payment_method="counter",
        otp_utr="—",
        status_raw=d.status,
        status_label=d.get_status_display(),
        platform_fee_inr="0",
        created_at=d.created_at.isoformat(),
        completed_at=d.completed_at.isoformat() if d.completed_at else None,
        detail={
            "purity_karat": d.purity_karat,
            "reference_metal_inr_per_gram": str(d.reference_metal_inr_per_gram),
            "jeweller_note": d.jeweller_note or "",
            "otp_expires_at": otp_expires,
        },
        actions=_deposit_actions(d),
    )


def _cp_payment_method(b: CridoraPayBill) -> str:
    parts: list[str] = []
    if b.vault_inr_applied and b.vault_inr_applied > 0:
        parts.append("vault")
    if b.cash_payable_inr and b.cash_payable_inr > 0:
        parts.append("cash")
    if b.payment_method == CridoraPayBill.PAY_UPI:
        parts.append("upi")
    if len(parts) > 1:
        return "mixed"
    return parts[0] if parts else (b.payment_method or "—")


def _cp_actions(b: CridoraPayBill) -> list[str]:
    if b.status == CridoraPayBill.STATUS_VAULT_OTP_PENDING:
        return ["verify_vault_otp"]
    if b.status == CridoraPayBill.STATUS_PENDING_REVIEW:
        return ["confirm_upi", "reject_upi"]
    if b.status == CridoraPayBill.STATUS_CASH_PENDING:
        return ["mark_cash_paid"]
    if b.status in CP_OPEN:
        return ["cancel_bill"]
    return []


def _map_cridorapay(b: CridoraPayBill) -> dict[str, Any]:
    return _build_row(
        source_model="cridorapay_bill",
        source_id=b.pk,
        reference=b.reference,
        transaction_type="cridorapay",
        customer=b.customer,
        amount_inr=str(b.total_inr),
        grams=str(b.weight_grams),
        payment_method=_cp_payment_method(b),
        otp_utr="—",
        status_raw=b.status,
        status_label=b.get_status_display(),
        platform_fee_inr="0",
        created_at=b.created_at.isoformat(),
        completed_at=b.completed_at.isoformat() if b.completed_at else None,
        detail={
            "title": b.title,
            "category": b.category,
            "purity": b.purity,
            "metal_rate_inr_per_gram": str(b.metal_rate_inr_per_gram),
            "vault_inr_applied": str(b.vault_inr_applied),
            "cash_payable_inr": str(b.cash_payable_inr),
            "payee_upi_vpa": b.payee_upi_vpa or "",
            "payment_note": b.payment_note or "",
            "upi_utr": b.upi_utr or "",
            "proof_file_url": b.upi_proof_file.url if b.upi_proof_file else "",
            "upi_rejection_count": b.upi_rejection_count,
            "upi_last_rejection_remark": b.upi_last_rejection_remark or "",
            "upi_fraud_reported": b.upi_fraud_reported,
        },
        actions=_cp_actions(b),
    )


def _ornament_payment_method(r: VaultProductRedemption) -> str:
    parts: list[str] = []
    if r.grams_charged and r.grams_charged > 0:
        parts.append("vault")
    if r.cash_paid_inr and r.cash_paid_inr > 0:
        parts.append(r.cash_payment_method or "cash")
    if len(parts) > 1:
        return "mixed"
    return parts[0] if parts else "—"


def _map_ornament(
    r: VaultProductRedemption,
    ledger: dict[tuple[str, int], Decimal],
) -> dict[str, Any]:
    fee = ledger.get(("ornament_redemption", r.pk))
    if fee is None:
        fee = r.cross_platform_fee_inr or Decimal("0")
    return _build_row(
        source_model="vault_product_redemption",
        source_id=r.pk,
        reference=f"RP-{r.pk}",
        transaction_type="ornament_redemption",
        customer=r.customer,
        amount_inr=str(r.final_invoice_inr),
        grams=str(r.grams_charged),
        payment_method=_ornament_payment_method(r),
        otp_utr="—",
        status_raw="completed",
        status_label="Completed",
        platform_fee_inr=str(fee),
        created_at=r.created_at.isoformat(),
        completed_at=r.created_at.isoformat(),
        detail={
            "product_name": r.product_name,
            "metal_rate_inr_per_gram": str(r.metal_rate_inr_per_gram),
            "cash_paid_inr": str(r.cash_paid_inr),
            "gst_on_gold_saved_inr": str(r.gst_on_gold_saved_inr),
            "same_store_checkout": r.same_store_checkout,
            "cross_platform_fee_inr": str(r.cross_platform_fee_inr),
        },
        actions=[],
    )


def _sellback_actions(s: GoldSellbackRequest) -> list[str]:
    if s.status == GoldSellbackRequest.STATUS_PENDING_JEWELLER:
        return ["accept_sellback", "reject_sellback"]
    if s.status == GoldSellbackRequest.STATUS_ACCEPTED_AWAITING_OTP:
        return ["complete_sellback_otp"]
    if s.status == GoldSellbackRequest.STATUS_AWAITING_UTR_VERIFY:
        return ["submit_sellback_utr"]
    return []


def _map_sellback(s: GoldSellbackRequest) -> dict[str, Any]:
    return _build_row(
        source_model="gold_sellback_request",
        source_id=s.pk,
        reference=f"SB-{s.pk}",
        transaction_type="sellback",
        customer=s.customer,
        amount_inr=str(s.cash_estimate_inr),
        grams=str(s.grams),
        payment_method=s.payment_method or "—",
        otp_utr=s.upi_utr or "—",
        status_raw=s.status,
        status_label=s.get_status_display(),
        platform_fee_inr="0",
        created_at=s.created_at.isoformat(),
        completed_at=s.updated_at.isoformat() if s.status == GoldSellbackRequest.STATUS_COMPLETED else None,
        detail={
            "reference_metal_inr_per_gram_snapshot": str(s.reference_metal_inr_per_gram_snapshot),
            "buyback_inr_per_gram_snapshot": str(s.buyback_inr_per_gram_snapshot),
            "payout_upi_vpa": s.payout_upi_vpa or "",
        },
        actions=_sellback_actions(s),
    )


def _loan_actions(l: GoldLoanRequest) -> list[str]:
    if l.status == GoldLoanRequest.STATUS_PENDING_JEWELLER:
        return ["accept_loan", "reject_loan"]
    if l.status == GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP:
        return ["complete_loan_otp"]
    return []


def _map_loan(l: GoldLoanRequest) -> dict[str, Any]:
    completed_at = None
    if l.status in LOAN_COMPLETED:
        completed_at = l.updated_at.isoformat()
    return _build_row(
        source_model="gold_loan_request",
        source_id=l.pk,
        reference=f"LN-{l.pk}",
        transaction_type="loan_fee",
        customer=l.customer,
        amount_inr=str(l.processing_fee_inr_snapshot),
        grams=str(l.grams),
        payment_method=l.payment_method or "cash",
        otp_utr="—",
        status_raw=l.status,
        status_label=l.get_status_display(),
        platform_fee_inr="0",
        created_at=l.created_at.isoformat(),
        completed_at=completed_at,
        detail={
            "collateral_value_inr": str(l.collateral_value_inr_snapshot),
            "gross_principal_inr": str(l.gross_principal_inr_snapshot),
            "net_disbursement_inr": str(l.net_disbursement_inr_snapshot),
            "ltv_percent": str(l.ltv_percent_snapshot),
        },
        actions=_loan_actions(l),
    )


def _status_filter(bucket: str) -> tuple[Any, ...]:
    if bucket == BUCKET_PENDING:
        return (
            JEWELLER_PENDING_STATUSES,
            (GoldDepositIntake.AWAITING_CUSTOMER_OTP,),
            CP_OPEN,
            (),
            SELLBACK_PENDING,
            LOAN_PENDING,
        )
    if bucket == BUCKET_COMPLETED:
        return (
            JEWELLER_APPROVED_STATUSES,
            (GoldDepositIntake.COMPLETED,),
            (CridoraPayBill.STATUS_COMPLETED,),
            ("ornament_all",),
            SELLBACK_COMPLETED,
            LOAN_COMPLETED,
        )
    return (
        JEWELLER_CANCELLED_STATUSES,
        (GoldDepositIntake.CANCELLED,),
        CP_CANCELLED,
        (),
        SELLBACK_CANCELLED,
        LOAN_CANCELLED,
    )


def _fetch_rows_for_bucket(
    jeweller: User,
    bucket: str,
    ledger: dict[tuple[str, int], Decimal],
) -> list[dict[str, Any]]:
    (
        frac_st,
        dep_st,
        cp_st,
        orn_st,
        sb_st,
        loan_st,
    ) = _status_filter(bucket)

    rows: list[dict[str, Any]] = []

    frac_qs = (
        FractionalGoldPurchase.objects.filter(jeweller=jeweller, status__in=frac_st)
        .select_related("customer")
        .order_by("-created_at")[:150]
    )
    for p in frac_qs:
        rows.append(_map_fractional(p, ledger))

    dep_qs = (
        GoldDepositIntake.objects.filter(jeweller=jeweller, status__in=dep_st)
        .select_related("customer", "counter_otp")
        .order_by("-created_at")[:150]
    )
    for d in dep_qs:
        rows.append(_map_deposit(d))

    cp_qs = (
        CridoraPayBill.objects.filter(jeweller=jeweller, status__in=cp_st)
        .select_related("customer")
        .order_by("-created_at")[:150]
    )
    for b in cp_qs:
        rows.append(_map_cridorapay(b))

    if bucket == BUCKET_COMPLETED:
        orn_qs = (
            VaultProductRedemption.objects.filter(jeweller=jeweller)
            .select_related("customer")
            .order_by("-created_at")[:150]
        )
        for r in orn_qs:
            rows.append(_map_ornament(r, ledger))

    sb_qs = (
        GoldSellbackRequest.objects.filter(jeweller=jeweller, status__in=sb_st)
        .select_related("customer")
        .order_by("-created_at")[:150]
    )
    for s in sb_qs:
        rows.append(_map_sellback(s))

    loan_qs = (
        GoldLoanRequest.objects.filter(jeweller=jeweller, status__in=loan_st)
        .select_related("customer")
        .order_by("-created_at")[:150]
    )
    for l in loan_qs:
        rows.append(_map_loan(l))

    return rows


def _apply_filters(
    rows: list[dict[str, Any]],
    *,
    txn_type: str,
    payment_method: str,
) -> list[dict[str, Any]]:
    out = rows
    if txn_type:
        out = [r for r in out if r["transaction_type"] == txn_type]
    if payment_method:
        out = [r for r in out if r["payment_method"] == payment_method]
    return out


def _pending_action_count(rows: list[dict[str, Any]]) -> int:
    return sum(1 for r in rows if r.get("actions"))


def jeweller_unified_desk_payload(
    jeweller: User,
    *,
    bucket: str = BUCKET_PENDING,
    txn_type: str = "",
    payment_method: str = "",
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    if jeweller.user_type != User.JEWELLER:
        return {"results": [], "count": 0, "summary": {}}

    bucket = bucket if bucket in (BUCKET_PENDING, BUCKET_COMPLETED, BUCKET_CANCELLED) else BUCKET_PENDING
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    ledger = _ledger_fee_map(jeweller)
    rows = _fetch_rows_for_bucket(jeweller, bucket, ledger)
    rows = _apply_filters(rows, txn_type=txn_type.strip(), payment_method=payment_method.strip())
    rows.sort(key=lambda r: r["created_at"], reverse=True)

    total = len(rows)
    page = rows[offset : offset + limit]

    pending_all = _fetch_rows_for_bucket(jeweller, BUCKET_PENDING, ledger)

    return {
        "results": page,
        "count": total,
        "bucket": bucket,
        "summary": {
            "pending_count": len(pending_all),
            "pending_action_count": _pending_action_count(pending_all),
        },
    }
