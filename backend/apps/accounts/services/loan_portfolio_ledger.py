"""Loan rows for customer and jeweller portfolio ledgers."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model

from apps.accounts.models import GoldLoanRepayment, GoldLoanRequest

User = get_user_model()


def _cust_label(u: User) -> str:
    return f"{u.first_name} {u.last_name}".strip() or (u.email or "")


def customer_loan_ledger_rows(customer: User) -> list[dict[str, Any]]:
    if customer.user_type != User.CUSTOMER:
        return []
    rows: list[dict[str, Any]] = []
    loans = (
        GoldLoanRequest.objects.filter(customer=customer)
        .exclude(status=GoldLoanRequest.STATUS_CANCELLED)
        .select_related("jeweller")
        .order_by("-created_at")[:80]
    )
    for loan in loans:
        jl = loan.jeweller
        jlabel = jl.business_name or jl.email or ""
        locked = loan.collateral_fractional_grams + loan.collateral_deposit_grams
        if locked > 0 or loan.status in (
            GoldLoanRequest.STATUS_PENDING_JEWELLER,
            GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP,
        ):
            rows.append(
                {
                    "occurred_at": loan.created_at.isoformat(),
                    "transaction_type": "loan_collateral_lock",
                    "reference": f"LN-{loan.id}",
                    "grams": str(loan.grams),
                    "label": f"Loan collateral locked · {jlabel}",
                    "jeweller_name": jlabel,
                    "current_value_inr": str(loan.collateral_value_inr_snapshot),
                    "amount_inr": "",
                    "loan_status": loan.status,
                }
            )
        if loan.status == GoldLoanRequest.STATUS_REJECTED:
            rows.append(
                {
                    "occurred_at": loan.updated_at.isoformat(),
                    "transaction_type": "loan_collateral_release",
                    "reference": f"LN-{loan.id}",
                    "grams": str(loan.grams),
                    "label": f"Loan rejected · collateral released · {jlabel}",
                    "jeweller_name": jlabel,
                    "current_value_inr": "",
                    "amount_inr": "",
                    "loan_status": loan.status,
                }
            )
        if loan.disbursed_at:
            rows.append(
                {
                    "occurred_at": loan.disbursed_at.isoformat(),
                    "transaction_type": "loan_disbursement",
                    "reference": f"LN-{loan.id}",
                    "grams": str(loan.grams),
                    "label": f"Loan cash received · {jlabel}",
                    "jeweller_name": jlabel,
                    "current_value_inr": str(loan.net_disbursement_inr_snapshot),
                    "amount_inr": str(loan.net_disbursement_inr_snapshot),
                    "loan_status": loan.status,
                }
            )
        for rep in loan.repayments.order_by("created_at"):
            rows.append(
                {
                    "occurred_at": rep.created_at.isoformat(),
                    "transaction_type": "loan_repayment",
                    "reference": f"LN-{loan.id}-R{rep.id}",
                    "grams": "",
                    "label": f"Loan repayment · {jlabel}",
                    "jeweller_name": jlabel,
                    "current_value_inr": str(rep.principal_after_inr),
                    "amount_inr": str(rep.amount_inr),
                    "loan_status": loan.status,
                }
            )
        if loan.status == GoldLoanRequest.STATUS_REPAID:
            rows.append(
                {
                    "occurred_at": loan.updated_at.isoformat(),
                    "transaction_type": "loan_collateral_release",
                    "reference": f"LN-{loan.id}",
                    "grams": str(loan.grams),
                    "label": f"Loan repaid · gold returned to vault · {jlabel}",
                    "jeweller_name": jlabel,
                    "current_value_inr": "",
                    "amount_inr": "",
                    "loan_status": loan.status,
                }
            )
    return rows


def jeweller_loan_ledger_rows(jeweller: User) -> list[dict[str, Any]]:
    if jeweller.user_type != User.JEWELLER:
        return []
    rows: list[dict[str, Any]] = []
    loans = (
        GoldLoanRequest.objects.filter(jeweller=jeweller)
        .exclude(status=GoldLoanRequest.STATUS_CANCELLED)
        .select_related("customer")
        .order_by("-updated_at")[:120]
    )
    for loan in loans:
        c = loan.customer
        clabel = _cust_label(c)
        if loan.status in (
            GoldLoanRequest.STATUS_PENDING_JEWELLER,
            GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP,
        ):
            rows.append(
                {
                    "occurred_at": loan.updated_at.isoformat(),
                    "transaction_type": "loan_pending",
                    "reference": f"LN-{loan.id}",
                    "grams": str(loan.grams),
                    "customer_label": clabel,
                    "customer_id": loan.customer_id,
                    "amount_inr": str(loan.net_disbursement_inr_snapshot),
                    "principal_outstanding_inr": str(loan.gross_principal_inr_snapshot),
                    "loan_status": loan.status,
                    "label": "Loan request pending",
                }
            )
        if loan.disbursed_at:
            rows.append(
                {
                    "occurred_at": loan.disbursed_at.isoformat(),
                    "transaction_type": "loan_disbursed",
                    "reference": f"LN-{loan.id}",
                    "grams": str(loan.grams),
                    "customer_label": clabel,
                    "customer_id": loan.customer_id,
                    "amount_inr": str(loan.net_disbursement_inr_snapshot),
                    "principal_outstanding_inr": str(loan.principal_outstanding_inr),
                    "loan_status": loan.status,
                    "label": "Loan disbursed",
                }
            )
        for rep in GoldLoanRepayment.objects.filter(loan=loan).order_by("created_at"):
            rows.append(
                {
                    "occurred_at": rep.created_at.isoformat(),
                    "transaction_type": "loan_repayment",
                    "reference": f"LN-{loan.id}-R{rep.id}",
                    "grams": str(loan.grams),
                    "customer_label": clabel,
                    "customer_id": loan.customer_id,
                    "amount_inr": str(rep.amount_inr),
                    "principal_outstanding_inr": str(rep.principal_after_inr),
                    "loan_status": loan.status,
                    "label": "Customer repayment",
                }
            )
    return rows


def jeweller_loans_by_customer_summary(jeweller: User) -> list[dict[str, Any]]:
    if jeweller.user_type != User.JEWELLER:
        return []
    active_statuses = (GoldLoanRequest.STATUS_DISBURSED,)
    pending_statuses = (
        GoldLoanRequest.STATUS_PENDING_JEWELLER,
        GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP,
    )
    loans = (
        GoldLoanRequest.objects.filter(jeweller=jeweller)
        .exclude(status__in=(GoldLoanRequest.STATUS_CANCELLED, GoldLoanRequest.STATUS_REJECTED))
        .select_related("customer")
        .order_by("customer_id", "-updated_at")
    )
    by_customer: dict[int, dict[str, Any]] = {}
    for loan in loans:
        cid = loan.customer_id
        if cid not in by_customer:
            c = loan.customer
            by_customer[cid] = {
                "customer_id": cid,
                "customer_label": _cust_label(c),
                "customer_member_id": c.cridora_member_id or "",
                "pending_count": 0,
                "active_count": 0,
                "total_principal_outstanding_inr": Decimal("0"),
                "total_collateral_locked_grams": Decimal("0"),
                "loans": [],
            }
        bucket = by_customer[cid]
        outstanding = loan.principal_outstanding_inr
        locked = loan.collateral_fractional_grams + loan.collateral_deposit_grams
        if loan.status in pending_statuses:
            bucket["pending_count"] += 1
        if loan.status in active_statuses:
            bucket["active_count"] += 1
            bucket["total_principal_outstanding_inr"] += outstanding
        if loan.status in active_statuses or loan.status in pending_statuses:
            bucket["total_collateral_locked_grams"] += locked
        bucket["loans"].append(
            {
                "id": loan.id,
                "reference": f"LN-{loan.id}",
                "status": loan.status,
                "grams": str(loan.grams),
                "gross_principal_inr": str(loan.gross_principal_inr_snapshot),
                "principal_paid_inr": str(loan.principal_paid_inr),
                "principal_outstanding_inr": str(outstanding),
                "net_disbursement_inr": str(loan.net_disbursement_inr_snapshot),
                "term_months": loan.term_months,
                "due_at": loan.due_at.isoformat() if loan.due_at else "",
                "updated_at": loan.updated_at.isoformat(),
            }
        )
    out = list(by_customer.values())
    for b in out:
        b["total_principal_outstanding_inr"] = str(
            b["total_principal_outstanding_inr"].quantize(Decimal("0.01"))
        )
        b["total_collateral_locked_grams"] = str(
            b["total_collateral_locked_grams"].quantize(Decimal("0.000001"))
        )
    out.sort(key=lambda x: Decimal(x["total_principal_outstanding_inr"] or "0"), reverse=True)
    return out
