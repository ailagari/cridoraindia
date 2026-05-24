"""Customer active vault gold: acquisition lots with cost, live mark, and P/L."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import (
    FractionalGoldPurchase,
    GoldDepositIntake,
    GoldTransfer,
)
from apps.accounts.vault_service import wallet_vault_payload
from apps.marketplace.models import jeweller_profile_for
from apps.marketplace.pricing import reference_metal_rate_inr_per_gram_for_jeweller
from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

User = get_user_model()

_SOURCE_LABELS = {
    "fractional": "Fractional buy",
    "deposit": "Gold deposit",
    "transfer_in": "Transfer in",
    "golden_scheme": "Golden scheme",
}


def _jeweller_rates(user: User) -> dict[int, Decimal]:
    rates: dict[int, Decimal] = {}
    for row in wallet_vault_payload(user):
        cid = int(row.get("custodian_id") or 0)
        raw = row.get("jeweller_metal_rate_inr_per_gram") or "0"
        try:
            rates[cid] = Decimal(str(raw))
        except Exception:
            rates[cid] = Decimal("0")
    return rates


def _fallback_rate(jeweller_id: int, rates: dict[int, Decimal]) -> Decimal:
    if jeweller_id in rates and rates[jeweller_id] > 0:
        return rates[jeweller_id]
    cridora_base, _ = resolve_cridora_base_22k_inr()
    try:
        j = User.objects.get(pk=jeweller_id, user_type=User.JEWELLER)
        profile = jeweller_profile_for(j)
        return reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
    except User.DoesNotExist:
        return cridora_base


def _pnl(cost: Decimal | None, live: Decimal) -> tuple[str, str]:
    if cost is None or cost <= 0:
        return "", ""
    pnl = (live - cost).quantize(Decimal("0.01"))
    pct = ((pnl / cost) * Decimal("100")).quantize(Decimal("0.01"))
    return str(pnl), str(pct)


def _lot(
    *,
    occurred_at: str,
    source_type: str,
    reference: str,
    jeweller_name: str,
    grams: Decimal,
    price_inr_per_gram: Decimal | None,
    cost_inr: Decimal | None,
    live_inr: Decimal,
) -> dict[str, Any]:
    pnl_inr, pnl_pct = _pnl(cost_inr, live_inr)
    return {
        "occurred_at": occurred_at,
        "source_type": source_type,
        "source_label": _SOURCE_LABELS.get(source_type, source_type.replace("_", " ").title()),
        "reference": reference,
        "jeweller_name": jeweller_name,
        "grams": str(grams.quantize(Decimal("0.000001"))),
        "price_inr_per_gram": (
            str(price_inr_per_gram.quantize(Decimal("0.01"))) if price_inr_per_gram is not None else ""
        ),
        "cost_inr": str(cost_inr.quantize(Decimal("0.01"))) if cost_inr is not None else "",
        "live_value_inr": str(live_inr.quantize(Decimal("0.01"))),
        "pnl_inr": pnl_inr,
        "pnl_percent": pnl_pct,
    }


def customer_active_gold_ledger_payload(user: User) -> dict[str, Any]:
    if user.user_type != User.CUSTOMER:
        return {"summary": {}, "lots": []}

    rates = _jeweller_rates(user)
    lots: list[dict[str, Any]] = []

    for p in (
        FractionalGoldPurchase.objects.filter(
            customer=user,
            status=FractionalGoldPurchase.COMPLETED,
        )
        .select_related("jeweller")
        .order_by("-created_at")[:100]
    ):
        rate = _fallback_rate(p.jeweller_id, rates)
        grams = p.grams
        cost = p.gold_value_inr_pre_gst.quantize(Decimal("0.01"))
        live = (grams * rate).quantize(Decimal("0.01"))
        price = (cost / grams).quantize(Decimal("0.01")) if grams > 0 else None
        occurred = (p.jeweller_verified_at or p.updated_at).isoformat()
        jlabel = p.jeweller.business_name or p.jeweller.email or ""
        lots.append(
            _lot(
                occurred_at=occurred,
                source_type="fractional",
                reference=f"FR-{p.pk}",
                jeweller_name=jlabel,
                grams=grams,
                price_inr_per_gram=price,
                cost_inr=cost,
                live_inr=live,
            )
        )

    for d in (
        GoldDepositIntake.objects.filter(
            customer=user,
            status=GoldDepositIntake.COMPLETED,
        )
        .select_related("jeweller")
        .order_by("-completed_at", "-created_at")[:100]
    ):
        rate = _fallback_rate(d.jeweller_id, rates)
        grams = d.grams
        cost = d.estimated_value_inr.quantize(Decimal("0.01"))
        live = (grams * rate).quantize(Decimal("0.01"))
        price = d.reference_metal_inr_per_gram.quantize(Decimal("0.01"))
        occurred = (d.completed_at or d.updated_at).isoformat()
        jlabel = d.jeweller.business_name or d.jeweller.email or ""
        lots.append(
            _lot(
                occurred_at=occurred,
                source_type="deposit",
                reference=f"GD-{d.pk}",
                jeweller_name=jlabel,
                grams=grams,
                price_inr_per_gram=price,
                cost_inr=cost,
                live_inr=live,
            )
        )

    for t in (
        GoldTransfer.objects.filter(to_user=user)
        .select_related("to_custodian", "from_user")
        .order_by("-created_at")[:100]
    ):
        if not t.to_custodian_id:
            continue
        rate = _fallback_rate(t.to_custodian_id, rates)
        grams = t.grams
        live = (grams * rate).quantize(Decimal("0.01"))
        jlabel = t.to_custodian.business_name or t.to_custodian.email or ""
        other = f"{t.from_user.first_name} {t.from_user.last_name}".strip() or t.from_user.email
        lots.append(
            _lot(
                occurred_at=t.created_at.isoformat(),
                source_type="transfer_in",
                reference=f"GT-{t.pk}",
                jeweller_name=jlabel,
                grams=grams,
                price_inr_per_gram=None,
                cost_inr=None,
                live_inr=live,
            )
        )
        lots[-1]["counterparty_label"] = other

    for row in wallet_vault_payload(user):
        scheme_g = Decimal(str(row.get("golden_scheme_grams") or "0"))
        if scheme_g <= 0:
            continue
        cid = int(row.get("custodian_id") or 0)
        live_raw = row.get("estimated_golden_scheme_value_inr")
        if live_raw not in (None, ""):
            live = Decimal(str(live_raw)).quantize(Decimal("0.01"))
        else:
            rate = _fallback_rate(cid, rates)
            live = (scheme_g * rate).quantize(Decimal("0.01"))
        jlabel = row.get("custodian_label") or f"Jeweller #{cid}"
        lots.append(
            _lot(
                occurred_at=timezone.now().isoformat(),
                source_type="golden_scheme",
                reference=f"SCHEME-{cid}",
                jeweller_name=jlabel,
                grams=scheme_g,
                price_inr_per_gram=None,
                cost_inr=None,
                live_inr=live,
            )
        )
        lots[-1]["note"] = "Current scheme balance — installment cost not tracked per lot."

    lots.sort(key=lambda x: x["occurred_at"], reverse=True)

    total_grams = Decimal("0")
    total_cost = Decimal("0")
    total_live = Decimal("0")
    total_pnl = Decimal("0")
    costed = False
    for lot in lots:
        total_grams += Decimal(lot["grams"])
        total_live += Decimal(lot["live_value_inr"])
        if lot["cost_inr"]:
            total_cost += Decimal(lot["cost_inr"])
            costed = True
            if lot["pnl_inr"]:
                total_pnl += Decimal(lot["pnl_inr"])

    summary = {
        "lot_count": len(lots),
        "total_grams": str(total_grams.quantize(Decimal("0.000001"))),
        "total_cost_inr": str(total_cost.quantize(Decimal("0.01"))) if costed else "",
        "total_live_value_inr": str(total_live.quantize(Decimal("0.01"))),
        "total_pnl_inr": str(total_pnl.quantize(Decimal("0.01"))) if costed else "",
        "total_pnl_percent": "",
    }
    if costed and total_cost > 0:
        summary["total_pnl_percent"] = str(
            ((total_live - total_cost) / total_cost * Decimal("100")).quantize(Decimal("0.01"))
        )

    return {"summary": summary, "lots": lots}
