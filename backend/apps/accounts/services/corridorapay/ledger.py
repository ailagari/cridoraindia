"""CridoraPay bill ledger rows for customer and jeweller dashboards."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model

from apps.accounts.models import CridoraPayBill

User = get_user_model()
_MAX_ROWS = 200


def _occurred_iso(bill: CridoraPayBill) -> str:
    dt = bill.completed_at or bill.created_at
    return dt.isoformat()


def _txn_type(bill: CridoraPayBill) -> str:
    if bill.status == CridoraPayBill.STATUS_COMPLETED:
        return "cridorapay_purchase"
    return f"cridorapay_{bill.status}"


def _row_from_bill(
    bill: CridoraPayBill,
    *,
    counterparty_label: str,
) -> dict[str, Any]:
    return {
        "occurred_at": _occurred_iso(bill),
        "transaction_type": _txn_type(bill),
        "reference": bill.reference,
        "status": bill.status,
        "label": bill.title,
        "grams": str(bill.weight_grams),
        "total_inr": str(bill.total_inr.quantize(Decimal("0.01"))),
        "payment_method": bill.payment_method or "",
        "vault_grams_chosen": str(bill.vault_grams_chosen),
        "cash_payable_inr": str(bill.cash_payable_inr.quantize(Decimal("0.01"))),
        "personal_holding_id": bill.personal_holding_id,
        "counterparty_label": counterparty_label,
    }


def corridorapay_ledger_payload_for_customer(user: User) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    qs = (
        CridoraPayBill.objects.filter(customer=user)
        .select_related("jeweller")
        .order_by("-created_at")[:_MAX_ROWS]
    )
    for bill in qs:
        j = bill.jeweller
        jlabel = (j.business_name or j.email or "").strip()
        rows.append(_row_from_bill(bill, counterparty_label=jlabel))
    rows.sort(key=lambda r: r["occurred_at"], reverse=True)
    return {"entries": rows}


def corridorapay_ledger_payload_for_jeweller(jeweller: User) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    qs = (
        CridoraPayBill.objects.filter(jeweller=jeweller)
        .select_related("customer")
        .order_by("-created_at")[:_MAX_ROWS]
    )
    for bill in qs:
        c = bill.customer
        clabel = f"{c.first_name} {c.last_name}".strip() or c.email or ""
        rows.append(_row_from_bill(bill, counterparty_label=clabel))
    rows.sort(key=lambda r: r["occurred_at"], reverse=True)
    return {"entries": rows}
