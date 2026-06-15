"""Per-metal live vs manual source for the public price ticker."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from .metal_ticker_adjustments import GOLD_KEYS, SILVER_KEYS
from .public_rate_copy import CRIDORA_MANUAL_RATE_NOTE

DEFAULT_TICKER_METAL_SOURCES: dict[str, dict[str, str]] = {
    "gold": {k: "live" for k in GOLD_KEYS},
    "silver": {k: "live" for k in SILVER_KEYS},
}

GOLD_KARAT_PURITY = {
    "24K": Decimal("1"),
    "22K": Decimal("0.916"),
    "21K": Decimal("0.875"),
    "18K": Decimal("0.750"),
}

SILVER_FINENESS = {
    "999": Decimal("1"),
    "925": Decimal("0.925"),
}


def _positive_decimal(value) -> Decimal | None:
    if value is None:
        return None
    try:
        v = Decimal(str(value))
    except Exception:
        return None
    return v if v > 0 else None


def normalize_ticker_metal_source_json(raw: Any, *, ticker: Any | None = None) -> dict[str, dict[str, str]]:
    """Return gold/silver → metal key → 'live' | 'manual'."""
    out: dict[str, dict[str, str]] = {
        "gold": dict(DEFAULT_TICKER_METAL_SOURCES["gold"]),
        "silver": dict(DEFAULT_TICKER_METAL_SOURCES["silver"]),
    }
    if isinstance(raw, dict):
        for family in ("gold", "silver"):
            block = raw.get(family)
            if not isinstance(block, dict):
                continue
            for key in out[family]:
                mode = str(block.get(key) or "live").strip().lower()
                out[family][key] = "manual" if mode == "manual" else "live"
    elif ticker is not None and getattr(ticker, "manual_ticker_enabled", False):
        for family in out:
            for key in out[family]:
                out[family][key] = "manual"
    return out


def ticker_metal_sources_for(ticker: Any) -> dict[str, dict[str, str]]:
    return normalize_ticker_metal_source_json(
        getattr(ticker, "ticker_metal_source_json", None),
        ticker=ticker,
    )


def metal_uses_manual(ticker: Any, *, family: str, key: str) -> bool:
    sources = ticker_metal_sources_for(ticker)
    block = sources.get(family) or {}
    return block.get(key, "live") == "manual"


def build_manual_rates_dict(ticker: Any) -> dict[str, dict[str, float]]:
    """Manual ₹/g per metal (derived ladder when optional fields are blank)."""
    k22 = _positive_decimal(getattr(ticker, "ticker_manual_22k_inr_per_gram", None))
    if k22 is None:
        return {"gold": {}, "silver": {}}

    k24 = _positive_decimal(getattr(ticker, "ticker_manual_24k_inr_per_gram", None))
    if k24 is None:
        k24 = (k22 / GOLD_KARAT_PURITY["22K"]).quantize(Decimal("0.01"))

    k18 = _positive_decimal(getattr(ticker, "ticker_manual_18k_inr_per_gram", None))
    if k18 is None:
        k18 = (k24 * GOLD_KARAT_PURITY["18K"]).quantize(Decimal("0.01"))

    gold = {
        "24K": float(k24),
        "22K": float(k22.quantize(Decimal("0.01"))),
        "21K": float((k24 * GOLD_KARAT_PURITY["21K"]).quantize(Decimal("0.01"))),
        "18K": float(k18),
    }

    silver: dict[str, float] = {}
    s999 = _positive_decimal(getattr(ticker, "ticker_manual_silver_999_inr_per_gram", None))
    if s999 is not None:
        s999r = s999.quantize(Decimal("0.001"))
        silver["999"] = float(s999r)
        silver["925"] = float((s999r * SILVER_FINENESS["925"]).quantize(Decimal("0.001")))

    return {"gold": gold, "silver": silver}


def manual_rate_for_metal(ticker: Any, *, family: str, key: str) -> float | None:
    rates = build_manual_rates_dict(ticker)
    bucket = rates.get(family) or {}
    v = bucket.get(key)
    return v if isinstance(v, (int, float)) and v > 0 else None


def any_metal_uses_manual(ticker: Any) -> bool:
    sources = ticker_metal_sources_for(ticker)
    return any(
        mode == "manual"
        for block in sources.values()
        for mode in block.values()
    )


def merge_live_and_manual_ticker_payload(live_adjusted: dict, ticker: Any) -> dict:
    """Overlay manual board rates on live-adjusted payload per metal source toggles."""
    sources = ticker_metal_sources_for(ticker)
    manual_rates = build_manual_rates_dict(ticker)
    live_gold = live_adjusted.get("gold") if isinstance(live_adjusted.get("gold"), dict) else {}
    live_silver = live_adjusted.get("silver") if isinstance(live_adjusted.get("silver"), dict) else {}

    out_gold: dict[str, float] = {}
    out_silver: dict[str, float] = {}
    any_manual = False
    any_live = False

    for k in GOLD_KEYS:
        if sources.get("gold", {}).get(k) == "manual":
            any_manual = True
            mv = manual_rates.get("gold", {}).get(k)
            if mv is not None:
                out_gold[k] = mv
        elif k in live_gold:
            any_live = True
            out_gold[k] = float(live_gold[k])

    for k in SILVER_KEYS:
        if sources.get("silver", {}).get(k) == "manual":
            any_manual = True
            mv = manual_rates.get("silver", {}).get(k)
            if mv is not None:
                out_silver[k] = mv
        elif k in live_silver:
            any_live = True
            out_silver[k] = float(live_silver[k])

    if any_manual and not any_live:
        src = "manual_ticker"
        note = CRIDORA_MANUAL_RATE_NOTE
    elif any_manual and any_live:
        src = "mixed_ticker"
        note = (
            "Cridora published rates — some metals follow the live Kerala feed, "
            "others use admin manual board rates."
        )
    else:
        src = str(live_adjusted.get("source") or "")
        note = str(live_adjusted.get("note") or "")

    return {
        **live_adjusted,
        "gold": out_gold,
        "silver": out_silver,
        "source": src,
        "note": note,
    }


def validate_manual_rates_for_sources(ticker: Any, sources: dict[str, dict[str, str]]) -> dict[str, str]:
    """Return field-level validation errors when manual is selected without a resolvable rate."""
    errors: dict[str, str] = {}
    manual_rates = build_manual_rates_dict(ticker)
    k22 = _positive_decimal(getattr(ticker, "ticker_manual_22k_inr_per_gram", None))

    for k in ("22K", "24K", "18K", "21K"):
        if sources.get("gold", {}).get(k) != "manual":
            continue
        if k22 is None and manual_rates.get("gold", {}).get(k) is None:
            errors["ticker_manual_22k_inr_per_gram"] = (
                "Enter a positive 22K ₹/g when any gold karat uses manual source."
            )
            break

    for k in ("999", "925"):
        if sources.get("silver", {}).get(k) != "manual":
            continue
        if manual_rates.get("silver", {}).get(k) is None:
            errors["ticker_manual_silver_999_inr_per_gram"] = (
                "Enter a positive silver 999 ₹/g when silver uses manual source."
            )
            break

    return errors
