"""Jeweller desk for UPI payments on hold after two rejected proofs."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from apps.accounts.models import (
    CridoraPayBill,
    FractionalGoldPurchase,
    GoldLoanRepaymentRequest,
)
from apps.accounts.services.jeweller_unified_desk import (
    _build_row,
    _ledger_fee_map,
    _map_cridorapay,
    _map_fractional,
)
from apps.accounts.services.upi_manual_payment.payload import latest_submissions

User = get_user_model()


def _map_loan_repayment_on_hold(r: GoldLoanRepaymentRequest) -> dict[str, Any]:
    submissions = latest_submissions("loan_repayment", r, limit=5)
    return _build_row(
        source_model="gold_loan_repayment_request",
        source_id=r.pk,
        reference=f"LRP-{r.pk}",
        transaction_type="loan_repayment",
        customer=r.loan.customer,
        amount_inr=str(r.amount_inr),
        grams="0",
        payment_method=r.payment_method or "upi",
        otp_utr=r.upi_utr or "—",
        status_raw=r.status,
        status_label=r.get_status_display(),
        platform_fee_inr="0",
        created_at=r.created_at.isoformat(),
        completed_at=None,
        detail={
            "loan_reference": f"LN-{r.loan_id}",
            "upi_utr": r.upi_utr or "",
            "proof_file_url": r.upi_proof_file.url if r.upi_proof_file else "",
            "upi_rejection_count": r.upi_rejection_count,
            "upi_last_rejection_remark": r.upi_last_rejection_remark or "",
            "submissions": submissions,
        },
        actions=["approve_in_person"],
    )


def jeweller_on_hold_payload(jeweller: User, *, limit: int = 50) -> dict[str, Any]:
    if jeweller.user_type != User.JEWELLER:
        return {"results": [], "count": 0}

    limit = max(1, min(limit, 200))
    ledger = _ledger_fee_map(jeweller)
    rows: list[dict[str, Any]] = []

    frac_qs = (
        FractionalGoldPurchase.objects.filter(
            jeweller=jeweller,
            status=FractionalGoldPurchase.ON_HOLD,
            payment_method=FractionalGoldPurchase.PAY_UPI,
        )
        .select_related("customer")
        .order_by("-updated_at")[:limit]
    )
    for p in frac_qs:
        row = _map_fractional(p, ledger)
        row["actions"] = ["approve_in_person"]
        row["detail"]["submissions"] = latest_submissions("fractional", p, limit=5)
        rows.append(row)

    cp_qs = (
        CridoraPayBill.objects.filter(
            jeweller=jeweller,
            status=CridoraPayBill.STATUS_ON_HOLD,
        )
        .select_related("customer")
        .order_by("-updated_at")[:limit]
    )
    for b in cp_qs:
        row = _map_cridorapay(b)
        row["actions"] = ["approve_in_person"]
        row["detail"]["submissions"] = latest_submissions("cridorapay", b, limit=5)
        rows.append(row)

    lr_qs = (
        GoldLoanRepaymentRequest.objects.filter(
            loan__jeweller=jeweller,
            status=GoldLoanRepaymentRequest.STATUS_ON_HOLD,
            payment_method=GoldLoanRepaymentRequest.PAY_UPI,
        )
        .select_related("loan__customer")
        .order_by("-updated_at")[:limit]
    )
    for r in lr_qs:
        rows.append(_map_loan_repayment_on_hold(r))

    rows.sort(key=lambda r: r["created_at"], reverse=True)
    return {"results": rows[:limit], "count": len(rows)}
