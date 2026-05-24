"""Customer active vault gold: current holdings lots with cost, live mark, and P/L."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import Sum

from apps.accounts.models import FractionalGoldPurchase, GoldDepositIntake, GoldVault
from apps.accounts.vault_service import sync_customer_aggregate_balance, wallet_vault_payload
from apps.marketplace.models import jeweller_profile_for
from apps.marketplace.pricing import reference_metal_rate_inr_per_gram_for_jeweller
from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

User = get_user_model()

_SOURCE_LABELS = {
    "fractional": "Fractional",
    "deposit": "Gold deposit",
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
    note: str = "",
) -> dict[str, Any]:
    pnl_inr, pnl_pct = _pnl(cost_inr, live_inr)
    row: dict[str, Any] = {
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
    if note:
        row["note"] = note
    return row


def _vault_updated_at(user: User, jeweller_id: int) -> str:
    vault = (
        GoldVault.objects.filter(owner=user, custodian_id=jeweller_id)
        .values_list("created_at", flat=True)
        .first()
    )
    if vault is not None:
        return vault.isoformat()
    return ""


def _fractional_cost_basis(
    user: User, jeweller_id: int, current_grams: Decimal
) -> tuple[Decimal | None, Decimal | None]:
    if current_grams <= 0:
        return None, None
    agg = FractionalGoldPurchase.objects.filter(
        customer=user,
        jeweller_id=jeweller_id,
        status=FractionalGoldPurchase.COMPLETED,
    ).aggregate(
        grams=Sum("grams"),
        cost=Sum("gold_value_inr_pre_gst"),
    )
    purchased_g = agg["grams"] or Decimal("0")
    purchased_cost = agg["cost"] or Decimal("0")
    if purchased_g <= 0 or purchased_cost <= 0:
        return None, None
    grams_basis = min(current_grams, purchased_g)
    cost = (grams_basis / purchased_g * purchased_cost).quantize(Decimal("0.01"))
    price = (cost / grams_basis).quantize(Decimal("0.01")) if grams_basis > 0 else None
    return cost, price


def _deposit_cost_basis(
    user: User, jeweller_id: int, current_grams: Decimal
) -> tuple[Decimal | None, Decimal | None]:
    if current_grams <= 0:
        return None, None
    agg = GoldDepositIntake.objects.filter(
        customer=user,
        jeweller_id=jeweller_id,
        status=GoldDepositIntake.COMPLETED,
    ).aggregate(
        grams=Sum("grams"),
        cost=Sum("estimated_value_inr"),
    )
    deposited_g = agg["grams"] or Decimal("0")
    deposited_cost = agg["cost"] or Decimal("0")
    if deposited_g <= 0 or deposited_cost <= 0:
        return None, None
    grams_basis = min(current_grams, deposited_g)
    cost = (grams_basis / deposited_g * deposited_cost).quantize(Decimal("0.01"))
    price = (cost / grams_basis).quantize(Decimal("0.01")) if grams_basis > 0 else None
    return cost, price


def customer_active_gold_ledger_payload(user: User) -> dict[str, Any]:
    if user.user_type != User.CUSTOMER:
        return {"summary": {}, "lots": []}

    sync_customer_aggregate_balance(user)
    bal = getattr(user, "gold_balance", None)
    vault_balance = bal.balance_grams if bal else Decimal("0")

    rates = _jeweller_rates(user)
    lots: list[dict[str, Any]] = []

    for row in wallet_vault_payload(user):
        cid = int(row.get("custodian_id") or 0)
        jlabel = row.get("custodian_label") or f"Jeweller #{cid}"
        rate = _fallback_rate(cid, rates)
        occurred = row.get("jeweller_metal_rate_last_updated_at") or _vault_updated_at(user, cid)

        g_frac = Decimal(str(row.get("fractional_grams") or "0"))
        if g_frac > 0:
            cost, price = _fractional_cost_basis(user, cid, g_frac)
            live = (g_frac * rate).quantize(Decimal("0.01"))
            note = ""
            if cost is None:
                note = "Includes transfers or legacy balance — purchase cost not fully tracked."
            lots.append(
                _lot(
                    occurred_at=occurred,
                    source_type="fractional",
                    reference=f"VAULT-{cid}-FRAC",
                    jeweller_name=jlabel,
                    grams=g_frac,
                    price_inr_per_gram=price,
                    cost_inr=cost,
                    live_inr=live,
                    note=note,
                )
            )

        g_dep = Decimal(str(row.get("deposit_grams") or "0"))
        if g_dep > 0:
            cost, price = _deposit_cost_basis(user, cid, g_dep)
            live = (g_dep * rate).quantize(Decimal("0.01"))
            lots.append(
                _lot(
                    occurred_at=occurred,
                    source_type="deposit",
                    reference=f"VAULT-{cid}-DEP",
                    jeweller_name=jlabel,
                    grams=g_dep,
                    price_inr_per_gram=price,
                    cost_inr=cost,
                    live_inr=live,
                )
            )

        g_scheme = Decimal(str(row.get("golden_scheme_grams") or "0"))
        if g_scheme > 0:
            live_raw = row.get("estimated_golden_scheme_value_inr")
            if live_raw not in (None, ""):
                live = Decimal(str(live_raw)).quantize(Decimal("0.01"))
            else:
                live = (g_scheme * rate).quantize(Decimal("0.01"))
            lots.append(
                _lot(
                    occurred_at=occurred,
                    source_type="golden_scheme",
                    reference=f"VAULT-{cid}-SCHEME",
                    jeweller_name=jlabel,
                    grams=g_scheme,
                    price_inr_per_gram=None,
                    cost_inr=None,
                    live_inr=live,
                    note="Current scheme balance — installment cost not tracked per lot.",
                )
            )

    lots.sort(key=lambda x: (x["jeweller_name"], x["source_type"]))

    total_live = Decimal("0")
    total_cost = Decimal("0")
    total_pnl = Decimal("0")
    costed = False
    for lot in lots:
        total_live += Decimal(lot["live_value_inr"])
        if lot["cost_inr"]:
            total_cost += Decimal(lot["cost_inr"])
            costed = True
            if lot["pnl_inr"]:
                total_pnl += Decimal(lot["pnl_inr"])

    summary = {
        "lot_count": len(lots),
        "vault_balance_grams": str(vault_balance.quantize(Decimal("0.000001"))),
        "total_grams": str(vault_balance.quantize(Decimal("0.000001"))),
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
