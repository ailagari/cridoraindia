"""Unified jeweller portfolio ledger: revenue INR + loan activity + liability grams."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model

from apps.accounts.jeweller_revenue_service import (
    jeweller_recent_revenue_entries,
    jeweller_revenue_by_kind,
    jeweller_total_revenue_inr,
)
from apps.accounts.models import GoldLoanRequest, JewellerLiabilityLedgerEntry, JewellerRevenueLedgerEntry
from apps.accounts.services.loan_portfolio_ledger import jeweller_loan_ledger_rows, jeweller_loans_by_customer_summary

User = get_user_model()

_KIND_LABEL = {
    JewellerRevenueLedgerEntry.KIND_FRACTIONAL_SALE: "Fractional sale",
    JewellerRevenueLedgerEntry.KIND_LOAN_PROCESSING_FEE: "Loan processing fee",
    JewellerRevenueLedgerEntry.KIND_ORNAMENT_SALE: "Ornament sale",
    JewellerRevenueLedgerEntry.KIND_DEPOSIT_INTAKE: "Deposit intake",
}


def jeweller_portfolio_ledger_payload(jeweller: User, *, ledger_filter: str = "all") -> dict[str, Any]:
    if jeweller.user_type != User.JEWELLER:
        return {"entries": [], "revenue_summary": {}, "loan_customers": []}

    rows: list[dict[str, Any]] = []

    for e in jeweller_recent_revenue_entries(jeweller, limit=80):
        rows.append(
            {
                "occurred_at": e["created_at"],
                "transaction_type": f"revenue_{e['kind']}",
                "reference": e.get("reference_label") or "",
                "grams": "",
                "amount_inr": e["amount_inr"],
                "label": _KIND_LABEL.get(e["kind"], e["kind"].replace("_", " ")),
                "customer_label": e.get("customer_label") or "",
                "current_value_inr": e["amount_inr"],
            }
        )

    for lr in jeweller_loan_ledger_rows(jeweller):
        txn = lr["transaction_type"]
        rows.append(
            {
                "occurred_at": lr["occurred_at"],
                "transaction_type": txn,
                "reference": lr["reference"],
                "grams": lr.get("grams") or "",
                "amount_inr": lr.get("amount_inr") or lr.get("principal_outstanding_inr") or "",
                "label": lr.get("label") or txn.replace("_", " "),
                "customer_label": lr.get("customer_label") or "",
                "current_value_inr": lr.get("principal_outstanding_inr") or lr.get("amount_inr") or "",
                "loan_status": lr.get("loan_status", ""),
            }
        )

    liab_qs = (
        JewellerLiabilityLedgerEntry.objects.filter(jeweller=jeweller)
        .select_related("customer")
        .order_by("-created_at")[:60]
    )
    for e in liab_qs:
        ref = ""
        if e.fractional_purchase_id:
            ref = f"FR-{e.fractional_purchase_id}"
        elif e.gold_deposit_intake_id:
            ref = f"GD-{e.gold_deposit_intake_id}"
        cust_label = ""
        if e.customer_id:
            u = e.customer
            cust_label = f"{u.first_name} {u.last_name}".strip() or (u.email or "")
        rows.append(
            {
                "occurred_at": e.created_at.isoformat(),
                "transaction_type": f"liability_{e.kind}",
                "reference": ref,
                "grams": str(e.grams),
                "amount_inr": "",
                "label": e.get_kind_display(),
                "customer_label": cust_label,
                "current_value_inr": "",
            }
        )

    rows.sort(key=lambda x: x["occurred_at"], reverse=True)

    allowed = {
        "all",
        "revenue",
        "loan",
        "liability",
        "fractional_sale",
        "loan_processing_fee",
        "ornament_sale",
        "loan_disbursed",
        "loan_repayment",
        "loan_pending",
    }
    lf = (ledger_filter or "all").strip().lower()
    if lf not in allowed:
        lf = "all"
    if lf == "revenue":
        rows = [r for r in rows if r["transaction_type"].startswith("revenue_")]
    elif lf == "loan":
        rows = [r for r in rows if "loan" in r["transaction_type"]]
    elif lf == "liability":
        rows = [r for r in rows if r["transaction_type"].startswith("liability_")]
    elif lf != "all":
        rows = [r for r in rows if r["transaction_type"] == lf or r["transaction_type"] == f"revenue_{lf}"]

    active_loans = GoldLoanRequest.objects.filter(
        jeweller=jeweller, status=GoldLoanRequest.STATUS_DISBURSED
    )
    total_out = sum((ln.principal_outstanding_inr for ln in active_loans), Decimal("0"))

    return {
        "entries": rows[:200],
        "revenue_summary": {
            "total_revenue_inr": str(jeweller_total_revenue_inr(jeweller).quantize(Decimal("0.01"))),
            "by_kind": jeweller_revenue_by_kind(jeweller),
        },
        "loan_summary": {
            "active_loan_count": active_loans.count(),
            "total_principal_outstanding_inr": str(total_out.quantize(Decimal("0.01"))),
            "pending_request_count": GoldLoanRequest.objects.filter(
                jeweller=jeweller,
                status__in=(
                    GoldLoanRequest.STATUS_PENDING_JEWELLER,
                    GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP,
                ),
            ).count(),
        },
        "loan_customers": jeweller_loans_by_customer_summary(jeweller),
    }
