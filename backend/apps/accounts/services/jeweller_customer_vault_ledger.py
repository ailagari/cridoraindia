"""Per-customer vault activity visible to the custodian jeweller (fractional + transfers)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import (
    FractionalGoldPurchase,
    GoldDepositIntake,
    GoldLoanRequest,
    GoldSellbackRequest,
    GoldTransfer,
    GoldVault,
    PersonalGoldHolding,
)
from apps.accounts.services.loan_portfolio_ledger import jeweller_loan_ledger_rows
from apps.marketplace.models import jeweller_profile_for
from apps.marketplace.pricing import reference_metal_rate_inr_per_gram_for_jeweller
from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

User = get_user_model()

METAL_TYPE_LABEL = "22K"
_MAX_ROWS = 200


def _occurred_iso(dt: datetime) -> str:
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt.isoformat()


def jeweller_can_access_customer_vault_ledger(jeweller: User, customer_id: int) -> bool:
    if jeweller.user_type != User.JEWELLER:
        return False
    if GoldVault.objects.filter(custodian=jeweller, owner_id=customer_id).exists():
        return True
    if FractionalGoldPurchase.objects.filter(
        jeweller=jeweller,
        customer_id=customer_id,
        status=FractionalGoldPurchase.COMPLETED,
    ).exists():
        return True
    q_touch = Q(from_user_id=customer_id, from_custodian_id=jeweller.id) | Q(
        to_user_id=customer_id,
        to_custodian_id=jeweller.id,
    )
    if GoldTransfer.objects.filter(q_touch).exists():
        return True
    if GoldSellbackRequest.objects.filter(jeweller=jeweller, customer_id=customer_id).exists():
        return True
    if PersonalGoldHolding.objects.filter(
        jeweller=jeweller, user_id=customer_id, is_removed=False
    ).exists():
        return True
    if GoldDepositIntake.objects.filter(jeweller=jeweller, customer_id=customer_id).exists():
        return True
    return GoldLoanRequest.objects.filter(jeweller=jeweller, customer_id=customer_id).exists()


def jeweller_customer_vault_ledger_payload(
    jeweller: User, customer_id: int, *, ledger_filter: str = "all"
) -> dict[str, Any]:
    profile = jeweller_profile_for(jeweller)
    cridora_base, _ = resolve_cridora_base_22k_inr()
    rate = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)

    rows: list[dict[str, Any]] = []

    purchases = (
        FractionalGoldPurchase.objects.filter(
            customer_id=customer_id,
            jeweller=jeweller,
            status=FractionalGoldPurchase.COMPLETED,
        )
        .order_by("-updated_at")[:_MAX_ROWS]
    )
    for p in purchases:
        grams = p.grams
        occurred_raw = p.jeweller_verified_at or p.updated_at
        metal_pre = p.gold_value_inr_pre_gst
        current_inr = (grams * rate).quantize(Decimal("0.01"))
        rows.append(
            {
                "occurred_at": _occurred_iso(occurred_raw),
                "transaction_type": "fractional",
                "grams": str(grams),
                "metal_type": METAL_TYPE_LABEL,
                "purchase_value_inr": str(metal_pre.quantize(Decimal("0.01"))),
                "invoice_total_inr": str(p.total_inr.quantize(Decimal("0.01"))),
                "current_value_inr": str(current_inr),
                "reference": f"FR-{p.id}",
                "counterparty_label": "",
            }
        )

    deposits = (
        GoldDepositIntake.objects.filter(
            customer_id=customer_id,
            jeweller=jeweller,
            status=GoldDepositIntake.COMPLETED,
        )
        .order_by("-completed_at")[:_MAX_ROWS]
    )
    for d in deposits:
        grams_d = d.grams
        occurred_dep = d.completed_at or d.updated_at
        metal_pre_d = (grams_d * d.reference_metal_inr_per_gram).quantize(Decimal("0.01"))
        current_inr_d = (grams_d * rate).quantize(Decimal("0.01"))
        purity_l = (d.purity_karat or "").strip()
        rows.append(
            {
                "occurred_at": _occurred_iso(occurred_dep),
                "transaction_type": "deposit",
                "grams": str(grams_d),
                "metal_type": METAL_TYPE_LABEL,
                "purchase_value_inr": str(metal_pre_d),
                "invoice_total_inr": None,
                "current_value_inr": str(current_inr_d),
                "reference": f"GD-{d.id}",
                "counterparty_label": purity_l,
            }
        )

    xfer_filter = Q(from_user_id=customer_id, from_custodian_id=jeweller.id) | Q(
        to_user_id=customer_id,
        to_custodian_id=jeweller.id,
    )
    transfers = (
        GoldTransfer.objects.filter(xfer_filter)
        .select_related("from_user", "to_user")
        .order_by("-created_at")[:_MAX_ROWS]
    )
    for t in transfers:
        grams = t.grams
        current_inr = (grams * rate).quantize(Decimal("0.01"))
        if t.from_user_id == customer_id and t.from_custodian_id == jeweller.id:
            txn_type = "transfer_out"
            other = t.to_user
        elif t.to_user_id == customer_id and t.to_custodian_id == jeweller.id:
            txn_type = "transfer_in"
            other = t.from_user
        else:
            continue
        label = f"{other.first_name} {other.last_name}".strip() or (other.email or "")
        rows.append(
            {
                "occurred_at": _occurred_iso(t.created_at),
                "transaction_type": txn_type,
                "grams": str(grams),
                "metal_type": METAL_TYPE_LABEL,
                "purchase_value_inr": None,
                "invoice_total_inr": None,
                "current_value_inr": str(current_inr),
                "reference": f"GT-{t.id}",
                "counterparty_label": label,
            }
        )

    sellbacks = (
        GoldSellbackRequest.objects.filter(
            customer_id=customer_id,
            jeweller=jeweller,
            status=GoldSellbackRequest.STATUS_COMPLETED,
        )
        .order_by("-created_at")[:_MAX_ROWS]
    )
    for s in sellbacks:
        rows.append(
            {
                "occurred_at": _occurred_iso(s.created_at),
                "transaction_type": "sellback",
                "grams": str(s.grams),
                "metal_type": METAL_TYPE_LABEL,
                "purchase_value_inr": None,
                "invoice_total_inr": None,
                "current_value_inr": str(s.cash_estimate_inr.quantize(Decimal("0.01"))),
                "reference": f"SB-{s.id}",
                "counterparty_label": "",
            }
        )

    rows.sort(key=lambda r: r["occurred_at"], reverse=True)

    from apps.accounts.models import CridoraPayBill

    cp_qs = (
        CridoraPayBill.objects.filter(
            jeweller=jeweller,
            customer_id=customer_id,
            status=CridoraPayBill.STATUS_COMPLETED,
        )
        .select_related("customer")
        .order_by("-completed_at", "-created_at")[:_MAX_ROWS]
    )
    for bill in cp_qs:
        g = bill.weight_grams
        current_inr = bill.total_inr.quantize(Decimal("0.01"))
        rows.append(
            {
                "occurred_at": _occurred_iso(bill.completed_at or bill.created_at),
                "transaction_type": "cridorapay_purchase",
                "grams": str(g),
                "metal_type": METAL_TYPE_LABEL,
                "purchase_value_inr": str(current_inr),
                "invoice_total_inr": str(current_inr),
                "current_value_inr": str(current_inr),
                "reference": bill.reference,
                "counterparty_label": bill.title[:120],
            }
        )

    for lr in jeweller_loan_ledger_rows(jeweller):
        if lr.get("customer_id") != customer_id:
            continue
        rows.append(
            {
                "occurred_at": lr["occurred_at"],
                "transaction_type": lr["transaction_type"],
                "grams": lr.get("grams") or "",
                "metal_type": METAL_TYPE_LABEL,
                "purchase_value_inr": None,
                "invoice_total_inr": lr.get("amount_inr"),
                "current_value_inr": lr.get("principal_outstanding_inr") or lr.get("amount_inr"),
                "reference": lr["reference"],
                "counterparty_label": lr.get("label") or "",
            }
        )

    rows.sort(key=lambda r: r["occurred_at"], reverse=True)

    allowed = {
        "all",
        "fractional",
        "deposit",
        "golden_scheme",
        "transfer_in",
        "transfer_out",
        "sellback",
        "cridorapay_purchase",
        "loan_disbursed",
        "loan_repayment",
        "loan_pending",
    }
    lf = (ledger_filter or "all").strip().lower()
    if lf not in allowed:
        lf = "all"
    if lf != "all":
        rows = [r for r in rows if r["transaction_type"] == lf]

    rows = rows[:_MAX_ROWS]

    return {
        "customer_id": customer_id,
        "reference_rate_inr_per_gram": str(rate.quantize(Decimal("0.01"))),
        "entries": rows,
    }
