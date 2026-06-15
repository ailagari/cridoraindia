"""Per-metal admin ticker: markup from live raw, then deduction from that reference."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

GOLD_KEYS = ("24K", "22K", "21K", "18K")
SILVER_KEYS = ("999", "925")

METAL_ADMIN_ROWS: tuple[tuple[str, str, str], ...] = (
    ("gold", "24K", "Gold 24K"),
    ("gold", "22K", "Gold 22K"),
    ("gold", "21K", "Gold 21K"),
    ("gold", "18K", "Gold 18K"),
    ("silver", "999", "Silver 999"),
    ("silver", "925", "Silver 925"),
)

# Omitted from admin live preview when no source publishes the rate.
OPTIONAL_LIVE_PREVIEW_KEYS: frozenset[tuple[str, str]] = frozenset({("gold", "21K")})

METAL_CODE_TO_TICKER: dict[str, tuple[str, str]] = {
    "gold_22k": ("gold", "22K"),
    "gold_24k": ("gold", "24K"),
    "gold_21k": ("gold", "21K"),
    "gold_18k": ("gold", "18K"),
    "silver_999": ("silver", "999"),
    "silver_925": ("silver", "925"),
}


def _normalize_side(raw: Any, *, default_mode: str = "percent") -> dict[str, str]:
    if not isinstance(raw, dict):
        return {"mode": default_mode, "amount": "0"}
    mode = raw.get("mode") or default_mode
    if mode not in ("percent", "fixed_inr"):
        mode = "percent"
    try:
        amt = Decimal(str(raw.get("amount", "0")))
    except Exception:
        amt = Decimal("0")
    if amt < 0:
        amt = Decimal("0")
    return {"mode": mode, "amount": str(amt)}


def _legacy_flat_entry(v: dict[str, Any]) -> bool:
    return "markup" not in v and "deduction" not in v and (
        "mode" in v or "deduction_mode" in v or "amount" in v
    )


def normalize_live_metal_adjustments_json(raw: Any) -> dict[str, dict[str, dict[str, dict[str, str]]]]:
    """gold/silver → karat key → { markup: {mode, amount}, deduction: {mode, amount} }."""
    if not isinstance(raw, dict):
        return {"gold": {}, "silver": {}}
    out: dict[str, dict[str, dict[str, dict[str, str]]]] = {"gold": {}, "silver": {}}
    for family in ("gold", "silver"):
        block = raw.get(family)
        if not isinstance(block, dict):
            continue
        for k, v in block.items():
            key = str(k)
            if not isinstance(v, dict):
                continue
            if _legacy_flat_entry(v):
                dm = v.get("mode") or v.get("deduction_mode") or "percent"
                if dm not in ("percent", "fixed_inr"):
                    dm = "percent"
                try:
                    da = Decimal(str(v.get("amount", "0")))
                except Exception:
                    da = Decimal("0")
                if da < 0:
                    da = Decimal("0")
                entry = {
                    "markup": {"mode": "percent", "amount": "0"},
                    "deduction": {"mode": dm, "amount": str(da)},
                }
            else:
                entry = {
                    "markup": _normalize_side(v.get("markup")),
                    "deduction": _normalize_side(v.get("deduction")),
                }
            out[family][key] = entry
    return out


def _entry_for(ticker: Any, *, family: str, key: str) -> dict[str, dict[str, str]]:
    cfg = normalize_live_metal_adjustments_json(getattr(ticker, "live_metal_adjustments_json", None))
    block = cfg.get(family) or {}
    return block.get(key) or {
        "markup": {"mode": "percent", "amount": "0"},
        "deduction": {"mode": "percent", "amount": "0"},
    }


def markup_for(ticker: Any, *, family: str, key: str) -> tuple[str, Decimal]:
    side = _entry_for(ticker, family=family, key=key)["markup"]
    mode = side.get("mode") or "percent"
    if mode not in ("percent", "fixed_inr"):
        mode = "percent"
    try:
        amount = Decimal(str(side.get("amount", "0")))
    except Exception:
        amount = Decimal("0")
    if amount < 0:
        amount = Decimal("0")
    return mode, amount


def deduction_for(ticker: Any, *, family: str, key: str) -> tuple[str, Decimal]:
    side = _entry_for(ticker, family=family, key=key)["deduction"]
    mode = side.get("mode") or "percent"
    if mode not in ("percent", "fixed_inr"):
        mode = "percent"
    try:
        amount = Decimal(str(side.get("amount", "0")))
    except Exception:
        amount = Decimal("0")
    if amount < 0:
        amount = Decimal("0")
    return mode, amount


def admin_deduction_for_jeweller_metal(ticker: Any, metal_code: str) -> tuple[str, Decimal]:
    mapped = METAL_CODE_TO_TICKER.get(metal_code)
    if not mapped:
        return "percent", Decimal("0")
    fam, k = mapped
    return deduction_for(ticker, family=fam, key=k)


def apply_markup(raw: Decimal, *, mode: str, amount: Decimal, quant: str) -> Decimal:
    if raw <= 0:
        return Decimal("0").quantize(Decimal(quant))
    if mode == "percent":
        p = min(amount, Decimal("1000"))
        out = raw * (Decimal("1") + p / Decimal("100"))
    else:
        out = raw + amount
    q = Decimal(quant)
    return max(Decimal("0"), out).quantize(q)


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


def after_markup_inr_from_decimal(raw: Decimal, *, family: str, key: str, ticker: Any) -> Decimal:
    quant = "0.001" if family == "silver" else "0.01"
    mm, ma = markup_for(ticker, family=family, key=key)
    return apply_markup(raw, mode=mm, amount=ma, quant=quant)


def adjusted_inr_from_decimal(raw: Decimal, *, family: str, key: str, ticker: Any) -> Decimal:
    quant = "0.001" if family == "silver" else "0.01"
    mid = after_markup_inr_from_decimal(raw, family=family, key=key, ticker=ticker)
    dm, da = deduction_for(ticker, family=family, key=key)
    return apply_deduction(mid, mode=dm, amount=da, quant=quant)


def adjusted_inr_from_float(raw_v: float | None, *, family: str, key: str, ticker: Any) -> Decimal:
    if raw_v is None:
        quant = "0.001" if family == "silver" else "0.01"
        return Decimal("0").quantize(Decimal(quant))
    return adjusted_inr_from_decimal(Decimal(str(raw_v)), family=family, key=key, ticker=ticker)


def apply_live_adjustments_to_spot_payload(raw_payload: dict, ticker: Any) -> dict:
    """Apply markup then deduction per metal to a raw spot-shaped payload (not manual ticker)."""
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
    extra = "Cridora live Kerala gold rate with platform markup/deduction applied."
    note = f"{base_note} {extra}".strip()
    return {
        **raw_payload,
        "gold": new_gold,
        "silver": new_silver,
        "note": note,
    }
