"""Per-metal live spot deductions for Cridora ticker (admin-configurable)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

GOLD_KEYS = ("24K", "22K", "21K", "18K")
SILVER_KEYS = ("999", "925")

# Admin UI / API preview row order
METAL_ADMIN_ROWS: tuple[tuple[str, str, str], ...] = (
    ("gold", "24K", "Gold 24K"),
    ("gold", "22K", "Gold 22K"),
    ("gold", "21K", "Gold 21K"),
    ("gold", "18K", "Gold 18K"),
    ("silver", "999", "Silver 999"),
    ("silver", "925", "Silver 925"),
)


def normalize_live_metal_adjustments_json(raw: Any) -> dict[str, dict[str, dict[str, str]]]:
    if not isinstance(raw, dict):
        return {"gold": {}, "silver": {}}
    out: dict[str, dict[str, dict[str, str]]] = {"gold": {}, "silver": {}}
    for family in ("gold", "silver"):
        block = raw.get(family)
        if not isinstance(block, dict):
            continue
        for k, v in block.items():
            key = str(k)
            if not isinstance(v, dict):
                continue
            mode = v.get("mode") or v.get("deduction_mode") or "percent"
            if mode not in ("percent", "fixed_inr"):
                mode = "percent"
            try:
                amt = Decimal(str(v.get("amount", "0")))
            except Exception:
                amt = Decimal("0")
            if amt < 0:
                amt = Decimal("0")
            out[family][key] = {"mode": mode, "amount": str(amt)}
    return out


def adjustment_for(ticker: Any, *, family: str, key: str) -> tuple[str, Decimal]:
    cfg = normalize_live_metal_adjustments_json(getattr(ticker, "live_metal_adjustments_json", None))
    block = cfg.get(family) or {}
    entry = block.get(key) or {}
    mode = entry.get("mode") or "percent"
    if mode not in ("percent", "fixed_inr"):
        mode = "percent"
    try:
        amount = Decimal(str(entry.get("amount", "0")))
    except Exception:
        amount = Decimal("0")
    if amount < 0:
        amount = Decimal("0")
    return mode, amount


def apply_deduction(raw: Decimal, *, mode: str, amount: Decimal, quant: str) -> Decimal:
    if raw <= 0:
        return Decimal("0").quantize(Decimal(quant))
    if mode == "percent":
        p = min(amount, Decimal("100"))
        out = raw * (Decimal("1") - p / Decimal("100"))
    else:
        out = raw - amount
    q = Decimal(quant)
    return max(Decimal("0"), out).quantize(q)


def adjusted_inr_from_decimal(raw: Decimal, *, family: str, key: str, ticker: Any) -> Decimal:
    mode, amount = adjustment_for(ticker, family=family, key=key)
    quant = "0.001" if family == "silver" else "0.01"
    return apply_deduction(raw, mode=mode, amount=amount, quant=quant)


def adjusted_inr_from_float(raw_v: float | None, *, family: str, key: str, ticker: Any) -> Decimal:
    if raw_v is None:
        quant = "0.001" if family == "silver" else "0.01"
        return Decimal("0").quantize(Decimal(quant))
    return adjusted_inr_from_decimal(Decimal(str(raw_v)), family=family, key=key, ticker=ticker)


def apply_live_adjustments_to_spot_payload(raw_payload: dict, ticker: Any) -> dict:
    """Apply per-metal deductions to a raw spot-shaped payload (not manual ticker)."""
    src = str(raw_payload.get("source") or "")
    if src == "manual_ticker":
        return raw_payload

    gold_in = raw_payload.get("gold")
    silver_in = raw_payload.get("silver")
    if not isinstance(gold_in, dict):
        return raw_payload

    new_gold: dict[str, float] = {}
    for k in GOLD_KEYS:
        if k not in gold_in:
            continue
        try:
            rv = float(gold_in[k])
        except (TypeError, ValueError):
            continue
        adj = adjusted_inr_from_float(rv, family="gold", key=k, ticker=ticker)
        new_gold[k] = float(adj)

    new_silver: dict[str, float] = {}
    if isinstance(silver_in, dict):
        for k in SILVER_KEYS:
            if k not in silver_in:
                continue
            try:
                rv = float(silver_in[k])
            except (TypeError, ValueError):
                continue
            adj = adjusted_inr_from_float(rv, family="silver", key=k, ticker=ticker)
            new_silver[k] = float(adj)

    base_note = str(raw_payload.get("note") or "").strip()
    extra = "Cridora reference = live metal rates after admin deductions."
    note = f"{base_note} {extra}".strip()
    out = {
        **raw_payload,
        "gold": new_gold,
        "silver": new_silver,
        "note": note,
    }
    return out
