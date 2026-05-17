"""Wallet API enrichment: completed fractional purchases & jeweller liability credits."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Sum

from .models import FractionalGoldPurchase, JewellerLiabilityLedgerEntry

User = get_user_model()


def customer_portfolio_unrealized_summary(
    customer: User, balance_grams: Decimal, vaults: list[dict]
) -> dict | None:
    """
    Estimated unrealized P&L: vault mark-to-market INR minus allocated gold purchase cost
    from completed fractional orders using metal value before GST (excludes gst_inr / fees).
    """
    if customer.user_type != User.CUSTOMER:
        return None
    market = Decimal("0")
    for row in vaults:
        ev = row.get("estimated_vault_value_inr")
        if ev not in (None, ""):
            market += Decimal(str(ev))
        else:
            market += Decimal(row.get("estimated_fractional_value_inr") or "0")
            market += Decimal(row.get("estimated_deposit_value_inr") or "0")
            market += Decimal(row.get("estimated_golden_scheme_value_inr") or "0")
    market_q = market.quantize(Decimal("0.01"))

    agg = FractionalGoldPurchase.objects.filter(
        customer=customer,
        status=FractionalGoldPurchase.COMPLETED,
    ).aggregate(
        gold_pre_gst=Sum("gold_value_inr_pre_gst"),
        grams=Sum("grams"),
    )
    pur_cost_inr = agg["gold_pre_gst"] or Decimal("0")
    pur_g = agg["grams"] or Decimal("0")

    if pur_g <= 0 or pur_cost_inr <= 0:
        return {
            "market_value_inr": str(market_q),
            "allocated_cost_inr": "0.00",
            "unrealized_pnl_inr": str(market_q),
            "unrealized_pnl_percent": "",
            "purchase_basis_inr_total": "0.00",
            "purchase_basis_grams_total": "0",
            "grams_allocated_for_cost": "0",
            "basis_note": (
                "Estimated vault value with no recorded fractional gold purchase cost (pre‑GST) — "
                "holdings from transfers or legacy balances may apply."
            ),
        }

    grams_costed = balance_grams if balance_grams <= pur_g else pur_g
    if grams_costed < 0:
        grams_costed = Decimal("0")
    allocated = (grams_costed / pur_g * pur_cost_inr).quantize(Decimal("0.01"))
    pnl = (market_q - allocated).quantize(Decimal("0.01"))
    pct_s = ""
    if allocated > 0:
        pct = ((market_q - allocated) / allocated * Decimal("100")).quantize(Decimal("0.01"))
        pct_s = str(pct)

    return {
        "purchase_basis_inr_total": str(pur_cost_inr.quantize(Decimal("0.01"))),
        "purchase_basis_grams_total": str(pur_g),
        "grams_allocated_for_cost": str(grams_costed),
        "allocated_cost_inr": str(allocated),
        "market_value_inr": str(market_q),
        "unrealized_pnl_inr": str(pnl),
        "unrealized_pnl_percent": pct_s,
        "basis_note": (
            "Unrealized P&L compares live vault marks (estimated metal value) to gold purchase cost "
            "allocated from your completed fractional buys — metal ₹ excluding GST and fees (GST/taxes "
            "shown separately on receipts). Transfers or legacy balances can skew this estimate."
        ),
    }


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
                "gold_value_inr_pre_gst": str(p.gold_value_inr_pre_gst),
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
        .select_related(
            "customer",
            "fractional_purchase",
            "gold_deposit_intake",
            "vault_product_redemption",
        )
        .order_by("-created_at")[:25]
    )
    rows = []
    for e in qs:
        ref = ""
        if e.fractional_purchase_id:
            ref = f"FR-{e.fractional_purchase_id}"
        elif e.gold_deposit_intake_id:
            ref = f"GD-{e.gold_deposit_intake_id}"
        elif e.vault_product_redemption_id:
            ref = f"RP-{e.vault_product_redemption_id}"
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
