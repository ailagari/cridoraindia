"""Jeweller loan dashboard: portfolio-wide and per-loan tracking."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model

from apps.accounts.models import (
    GoldLoanRepayment,
    GoldLoanRepaymentRequest,
    GoldLoanRequest,
)
from apps.accounts.services.loan_portfolio_ledger import (
    jeweller_loan_ledger_rows,
    jeweller_loans_by_customer_summary,
)

User = get_user_model()


def _cust_label(u: User) -> str:
    return f"{u.first_name} {u.last_name}".strip() or (u.email or "")


def _open_repayment_statuses() -> tuple[str, ...]:
    return (
        GoldLoanRepaymentRequest.STATUS_PENDING_JEWELLER,
        GoldLoanRepaymentRequest.STATUS_ACCEPTED_AWAITING_OTP,
    )


def _serialize_repayment(rep: GoldLoanRepayment) -> dict[str, str]:
    return {
        "id": rep.id,
        "amount_inr": str(rep.amount_inr),
        "principal_after_inr": str(rep.principal_after_inr),
        "created_at": rep.created_at.isoformat(),
    }


def _serialize_open_repayment(req: GoldLoanRepaymentRequest) -> dict[str, str]:
    return {
        "id": req.id,
        "reference": f"LRP-{req.id}",
        "amount_inr": str(req.amount_inr),
        "status": req.status,
        "created_at": req.created_at.isoformat(),
        "updated_at": req.updated_at.isoformat(),
    }


def _serialize_loan_detail(loan: GoldLoanRequest) -> dict[str, Any]:
    c = loan.customer
    phone = (getattr(c, "phone", None) or "").strip()
    locked = loan.collateral_fractional_grams + loan.collateral_deposit_grams
    open_rep = (
        loan.repayment_requests.filter(status__in=_open_repayment_statuses())
        .order_by("-updated_at")
        .first()
    )
    repayments = list(loan.repayments.order_by("created_at"))
    return {
        "id": loan.id,
        "reference": f"LN-{loan.id}",
        "status": loan.status,
        "customer_id": loan.customer_id,
        "customer_label": _cust_label(c),
        "customer_phone": phone if phone else "—",
        "customer_member_id": c.cridora_member_id or "",
        "grams": str(loan.grams),
        "collateral_locked_grams": str(locked),
        "collateral_fractional_grams": str(loan.collateral_fractional_grams),
        "collateral_deposit_grams": str(loan.collateral_deposit_grams),
        "collateral_value_inr": str(loan.collateral_value_inr_snapshot),
        "ltv_percent": str(loan.ltv_percent_snapshot),
        "gross_principal_inr": str(loan.gross_principal_inr_snapshot),
        "principal_paid_inr": str(loan.principal_paid_inr),
        "principal_outstanding_inr": str(loan.principal_outstanding_inr),
        "processing_fee_inr": str(loan.processing_fee_inr_snapshot),
        "net_disbursement_inr": str(loan.net_disbursement_inr_snapshot),
        "term_months": loan.term_months,
        "payment_method": loan.payment_method,
        "created_at": loan.created_at.isoformat(),
        "updated_at": loan.updated_at.isoformat(),
        "disbursed_at": loan.disbursed_at.isoformat() if loan.disbursed_at else "",
        "due_at": loan.due_at.isoformat() if loan.due_at else "",
        "collateral_released": "true" if loan.status == GoldLoanRequest.STATUS_REPAID else "false",
        "repayments": [_serialize_repayment(r) for r in repayments],
        "total_repaid_inr": str(
            sum((r.amount_inr for r in repayments), Decimal("0")).quantize(Decimal("0.01"))
        ),
        "open_repayment_request": (
            _serialize_open_repayment(open_rep) if open_rep else None
        ),
    }


def jeweller_loan_dashboard(jeweller: User) -> dict[str, Any]:
    if jeweller.user_type != User.JEWELLER:
        return {}

    loans_qs = (
        GoldLoanRequest.objects.filter(jeweller=jeweller)
        .exclude(status=GoldLoanRequest.STATUS_CANCELLED)
        .select_related("customer")
        .prefetch_related("repayments", "repayment_requests")
        .order_by("-updated_at", "-id")
    )
    loans = list(loans_qs)

    total_gross_disbursed = Decimal("0")
    total_net_disbursed = Decimal("0")
    total_repaid = Decimal("0")
    total_outstanding = Decimal("0")
    total_collateral_locked = Decimal("0")
    active_count = 0
    repaid_count = 0
    pending_disbursement_count = 0
    rejected_count = 0

    pending_statuses = (
        GoldLoanRequest.STATUS_PENDING_JEWELLER,
        GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP,
    )

    for loan in loans:
        if loan.status == GoldLoanRequest.STATUS_REJECTED:
            rejected_count += 1
            continue
        if loan.status in pending_statuses:
            pending_disbursement_count += 1
        if loan.status == GoldLoanRequest.STATUS_DISBURSED:
            active_count += 1
            total_gross_disbursed += loan.gross_principal_inr_snapshot
            total_net_disbursed += loan.net_disbursement_inr_snapshot
            total_repaid += loan.principal_paid_inr
            total_outstanding += loan.principal_outstanding_inr
            total_collateral_locked += (
                loan.collateral_fractional_grams + loan.collateral_deposit_grams
            )
        if loan.status == GoldLoanRequest.STATUS_REPAID:
            repaid_count += 1
            total_gross_disbursed += loan.gross_principal_inr_snapshot
            total_net_disbursed += loan.net_disbursement_inr_snapshot
            total_repaid += loan.gross_principal_inr_snapshot

    pending_repayments = list(
        GoldLoanRepaymentRequest.objects.filter(
            loan__jeweller=jeweller,
            status__in=_open_repayment_statuses(),
        )
        .select_related("loan", "loan__customer")
        .order_by("-updated_at")[:50]
    )

    ledger = sorted(
        jeweller_loan_ledger_rows(jeweller),
        key=lambda r: r.get("occurred_at") or "",
        reverse=True,
    )[:200]

    customers = jeweller_loans_by_customer_summary(jeweller)

    return {
        "summary": {
            "total_loan_count": str(len(loans) - rejected_count),
            "active_loan_count": str(active_count),
            "repaid_loan_count": str(repaid_count),
            "pending_disbursement_count": str(pending_disbursement_count),
            "pending_repayment_count": str(len(pending_repayments)),
            "total_gross_principal_disbursed_inr": str(
                total_gross_disbursed.quantize(Decimal("0.01"))
            ),
            "total_net_cash_disbursed_inr": str(
                total_net_disbursed.quantize(Decimal("0.01"))
            ),
            "total_principal_repaid_inr": str(total_repaid.quantize(Decimal("0.01"))),
            "total_principal_outstanding_inr": str(
                total_outstanding.quantize(Decimal("0.01"))
            ),
            "total_collateral_locked_grams": str(
                total_collateral_locked.quantize(Decimal("0.000001"))
            ),
        },
        "loans": [_serialize_loan_detail(loan) for loan in loans if loan.status != GoldLoanRequest.STATUS_REJECTED],
        "repayment_ledger": ledger,
        "customers": customers,
        "pending_disbursements": [
            _serialize_loan_detail(loan)
            for loan in loans
            if loan.status in pending_statuses
        ],
        "pending_repayments": [
            {
                **_serialize_open_repayment(req),
                "loan_id": req.loan_id,
                "loan_reference": f"LN-{req.loan_id}",
                "customer_id": req.loan.customer_id,
                "customer_label": _cust_label(req.loan.customer),
                "principal_outstanding_inr": str(req.loan.principal_outstanding_inr),
            }
            for req in pending_repayments
        ],
    }
