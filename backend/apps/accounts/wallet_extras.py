"""Wallet API enrichment: completed fractional purchases & jeweller liability credits."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from .models import FractionalGoldPurchase, JewellerLiabilityLedgerEntry

User = get_user_model()


def customer_completed_fractional_ledger(customer: User) -> list[dict]:
    if customer.user_type != User.CUSTOMER:
        return []
    qs = (
        FractionalGoldPurchase.objects.filter(
            customer=customer,
            status=FractionalGoldPurchase.COMPLETED,
        )
        .select_related("jeweller")
        .order_by("-created_at")[:40]
    )
    rows = []
    for p in qs:
        rows.append(
            {
                "reference": f"FR-{p.id}",
                "created_at": p.created_at.isoformat(),
                "jeweller_name": p.jeweller.business_name or p.jeweller.email or "",
                "grams": str(p.grams),
                "total_inr": str(p.total_inr),
                "payment_method": p.payment_method,
            }
        )
    return rows


def jeweller_recent_liability_credits(jeweller: User) -> list[dict]:
    if jeweller.user_type != User.JEWELLER:
        return []
    qs = (
        JewellerLiabilityLedgerEntry.objects.filter(jeweller=jeweller)
        .select_related("customer", "fractional_purchase")
        .order_by("-created_at")[:25]
    )
    rows = []
    for e in qs:
        ref = ""
        if e.fractional_purchase_id:
            ref = f"FR-{e.fractional_purchase_id}"
        mid = ""
        cust_label = ""
        if e.customer_id:
            u = e.customer
            mid = u.cridora_member_id or ""
            cust_label = f"{u.first_name} {u.last_name}".strip() or (u.email or "")
        rows.append(
            {
                "grams": str(e.grams),
                "created_at": e.created_at.isoformat(),
                "customer_member_id": mid,
                "customer_label": cust_label,
                "purchase_reference": ref,
            }
        )
    return rows
