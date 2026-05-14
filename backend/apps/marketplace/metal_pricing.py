"""Per-metal reference rates (vs Cridora spot), jeweller policies, and buyback blocks."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from .models import JewellerPricingProfile
from .spot_prices import public_spot_prices_payload

METAL_CODES: tuple[str, ...] = (
    "gold_22k",
    "gold_24k",
    "gold_21k",
    "gold_18k",
    "silver_999",
    "silver_925",
)

MODE_MATCH_CRIDORA = "match_cridora"
MODE_MARKUP_ON_CRIDORA = "markup_on_cridora"
MODE_MANUAL_BOARD = "manual_board_inr"
MODE_EXTERNAL_API = "external_api"

METAL_MODES: tuple[str, ...] = (
    MODE_MATCH_CRIDORA,
    MODE_MARKUP_ON_CRIDORA,
    MODE_MANUAL_BOARD,
    MODE_EXTERNAL_API,
)

_GOLD_SPOT_KEYS = {
    "gold_22k": "22K",
    "gold_24k": "24K",
    "gold_21k": "21K",
    "gold_18k": "18K",
}

_SILVER_SPOT_KEYS = {
    "silver_999": "999",
    "silver_925": "925",
}


def default_pricing_block() -> dict[str, str]:
    return {
        "mode": MODE_MATCH_CRIDORA,
        "markup_percent": "0",
        "markup_inr_per_gram": "0",
        "manual_inr_per_gram": "0",
        "external_api_url": "",
    }


def default_buyback_block() -> dict[str, str]:
    return {
        "deduction_percent": "0",
        "fixed_inr_per_gram": "0",
        "jeweller_deduction_inr_per_gram": "0",
    }


def normalize_metal_pricing_json(raw: Any) -> dict[str, dict[str, str]]:
    src = raw if isinstance(raw, dict) else {}
    out: dict[str, dict[str, str]] = {}
    for code in METAL_CODES:
        block = src.get(code)
        b = default_pricing_block()
        if isinstance(block, dict):
            mode = str(block.get("mode") or MODE_MATCH_CRIDORA).strip()
            if mode not in METAL_MODES:
                mode = MODE_MATCH_CRIDORA
            b["mode"] = mode
            for key in ("markup_percent", "markup_inr_per_gram", "manual_inr_per_gram"):
                b[key] = _dec_str(block.get(key), "0")
            url = block.get("external_api_url")
            b["external_api_url"] = str(url).strip()[:512] if url is not None else ""
        out[code] = b
    return out


def normalize_metal_buyback_json(raw: Any) -> dict[str, dict[str, str]]:
    src = raw if isinstance(raw, dict) else {}
    out: dict[str, dict[str, str]] = {}
    for code in METAL_CODES:
        block = src.get(code)
        b = default_buyback_block()
        if isinstance(block, dict):
            for key in (
                "deduction_percent",
                "fixed_inr_per_gram",
                "jeweller_deduction_inr_per_gram",
            ):
                b[key] = _dec_str(block.get(key), "0")
        out[code] = b
    return out


def _dec_str(v: Any, default: str = "0") -> str:
    if v is None or v == "":
        return default
    try:
        d = Decimal(str(v))
        if d < 0:
            d = Decimal("0")
        return format(d.normalize(), "f")
    except Exception:
        return default


def cridora_reference_inr_per_metal(
    metal_code: str, *, cridora_base_22k: Decimal, spot: dict[str, Any]
) -> Decimal:
    """Indicative Cridora ₹/g for this metal row (spot feed or derived)."""
    gold = spot.get("gold") if isinstance(spot.get("gold"), dict) else {}
    silver = spot.get("silver") if isinstance(spot.get("silver"), dict) else {}

    if metal_code == "gold_22k":
        return cridora_base_22k.quantize(Decimal("0.01"))

    gk = _GOLD_SPOT_KEYS.get(metal_code)
    if gk:
        v = gold.get(gk)
        if v is not None:
            try:
                return Decimal(str(v)).quantize(Decimal("0.01"))
            except Exception:
                pass
        if cridora_base_22k > 0 and metal_code == "gold_24k":
            return (cridora_base_22k / Decimal("0.916")).quantize(Decimal("0.01"))
        if cridora_base_22k > 0:
            purity = {
                "gold_21k": Decimal("0.875"),
                "gold_18k": Decimal("0.750"),
            }.get(metal_code)
            if purity:
                fine = cridora_base_22k / Decimal("0.916")
                return (fine * purity).quantize(Decimal("0.01"))
        return Decimal("0")

    sk = _SILVER_SPOT_KEYS.get(metal_code)
    if sk:
        v = silver.get(sk)
        if v is not None:
            try:
                return Decimal(str(v)).quantize(Decimal("0.01"))
            except Exception:
                pass
        return Decimal("0")

    return Decimal("0")


def jeweller_effective_rate_inr(
    profile: JewellerPricingProfile,
    metal_code: str,
    *,
    cridora_base_22k: Decimal,
    spot: dict[str, Any],
) -> Decimal:
    """Jeweller board ₹/g for a metal after policy (preview / storefront extensions)."""
    if metal_code not in METAL_CODES:
        return Decimal("0")

    pmap = normalize_metal_pricing_json(profile.metal_pricing_json)
    block = pmap.get(metal_code) or default_pricing_block()
    ref = cridora_reference_inr_per_metal(
        metal_code, cridora_base_22k=cridora_base_22k, spot=spot
    )

    mode = block.get("mode") or MODE_MATCH_CRIDORA

    if mode == MODE_EXTERNAL_API:
        return ref.quantize(Decimal("0.01"))

    if mode == MODE_MATCH_CRIDORA:
        return ref.quantize(Decimal("0.01"))

    if mode == MODE_MANUAL_BOARD:
        m = Decimal(block.get("manual_inr_per_gram") or "0")
        if m > 0:
            return m.quantize(Decimal("0.01"))
        return ref.quantize(Decimal("0.01"))

    # markup_on_cridora
    pct = Decimal(block.get("markup_percent") or "0") / Decimal("100")
    fixed = Decimal(block.get("markup_inr_per_gram") or "0")
    out = ref * (Decimal("1") + pct) + fixed
    return max(Decimal("0"), out).quantize(Decimal("0.01"))


def jeweller_store_22k_inr_legacy(
    profile: JewellerPricingProfile, cridora_base: Decimal
) -> Decimal:
    """Previous single-metal behaviour when JSON policies are not populated."""
    if profile.gold_rate_source == JewellerPricingProfile.GOLD_RATE_MANUAL:
        m = profile.manual_gold_rate_inr_per_gram
        if m is not None and m > 0:
            return m.quantize(Decimal("0.01"))
        return cridora_base.quantize(Decimal("0.01"))
    p = profile.live_markup_percent / Decimal("100")
    fixed = profile.live_markup_inr_per_gram
    return (cridora_base * (Decimal("1") + p) + fixed).quantize(Decimal("0.01"))


def jeweller_store_22k_inr(profile: JewellerPricingProfile, cridora_base: Decimal) -> Decimal:
    spot = public_spot_prices_payload()
    pmap = profile.metal_pricing_json if isinstance(profile.metal_pricing_json, dict) else {}
    if pmap.get("gold_22k"):
        return jeweller_effective_rate_inr(
            profile,
            "gold_22k",
            cridora_base_22k=cridora_base,
            spot=spot,
        )
    return jeweller_store_22k_inr_legacy(profile, cridora_base)


def sellback_components_for_metal(
    profile: JewellerPricingProfile, metal_code: str
) -> tuple[Decimal, Decimal, Decimal]:
    """Percent deduction, fixed ₹/g, jeweller extra ₹/g (buyback spread)."""
    raw_buy = profile.metal_buyback_json if isinstance(profile.metal_buyback_json, dict) else {}
    if metal_code == "gold_22k" and not raw_buy.get("gold_22k"):
        return (
            profile.sellback_deduction_percent,
            profile.sellback_fixed_inr_per_gram,
            Decimal("0"),
        )

    bmap = normalize_metal_buyback_json(profile.metal_buyback_json)
    block = bmap.get(metal_code) or default_buyback_block()
    pct = Decimal(block.get("deduction_percent") or "0")
    fixed = Decimal(block.get("fixed_inr_per_gram") or "0")
    extra = Decimal(block.get("jeweller_deduction_inr_per_gram") or "0")
    return pct, fixed, extra


def sellback_rate_inr_per_gram(metal_rate: Decimal, profile: JewellerPricingProfile) -> Decimal:
    pct, fixed, extra = sellback_components_for_metal(profile, "gold_22k")
    p = pct / Decimal("100")
    after_pct = metal_rate * (Decimal("1") - p)
    out = after_pct - fixed - extra
    return max(Decimal("0"), out.quantize(Decimal("0.01")))


def indicative_buyback_inr_per_metal(
    profile: JewellerPricingProfile,
    metal_code: str,
    *,
    jeweller_effective_inr_per_gram: Decimal,
) -> Decimal:
    pct, fixed, extra = sellback_components_for_metal(profile, metal_code)
    p = pct / Decimal("100")
    after_pct = jeweller_effective_inr_per_gram * (Decimal("1") - p)
    out = after_pct - fixed - extra
    return max(Decimal("0"), out.quantize(Decimal("0.01")))


def sync_gold_22k_legacy_fields_from_json(profile: JewellerPricingProfile) -> None:
    """Keep MarketplaceProduct pricing paths aligned with gold_22k JSON row."""
    pmap = normalize_metal_pricing_json(profile.metal_pricing_json)
    b22 = pmap.get("gold_22k") or default_pricing_block()
    mode = b22.get("mode") or MODE_MATCH_CRIDORA

    if mode == MODE_MANUAL_BOARD:
        profile.gold_rate_source = JewellerPricingProfile.GOLD_RATE_MANUAL
        try:
            profile.manual_gold_rate_inr_per_gram = Decimal(
                b22.get("manual_inr_per_gram") or "0"
            ).quantize(Decimal("0.01"))
        except Exception:
            profile.manual_gold_rate_inr_per_gram = None
        profile.live_markup_percent = Decimal("0")
        profile.live_markup_inr_per_gram = Decimal("0")
    else:
        profile.gold_rate_source = JewellerPricingProfile.GOLD_RATE_LIVE_CRIDORA
        profile.manual_gold_rate_inr_per_gram = None
        if mode == MODE_MARKUP_ON_CRIDORA:
            try:
                profile.live_markup_percent = Decimal(b22.get("markup_percent") or "0")
            except Exception:
                profile.live_markup_percent = Decimal("0")
            try:
                profile.live_markup_inr_per_gram = Decimal(
                    b22.get("markup_inr_per_gram") or "0"
                ).quantize(Decimal("0.01"))
            except Exception:
                profile.live_markup_inr_per_gram = Decimal("0")
        else:
            profile.live_markup_percent = Decimal("0")
            profile.live_markup_inr_per_gram = Decimal("0")

    if b22.get("external_api_url"):
        profile.gold_rate_external_api_url = str(b22.get("external_api_url"))[:512]

    bb = normalize_metal_buyback_json(profile.metal_buyback_json).get("gold_22k")
    if bb:
        try:
            profile.sellback_deduction_percent = Decimal(bb.get("deduction_percent") or "0")
        except Exception:
            pass
        try:
            profile.sellback_fixed_inr_per_gram = Decimal(
                bb.get("fixed_inr_per_gram") or "0"
            ).quantize(Decimal("0.01"))
        except Exception:
            pass


def populate_metal_json_from_legacy(profile: JewellerPricingProfile) -> dict[str, dict[str, str]]:
    """Initial JSON rows from legacy columns (migration / lazy backfill)."""
    pmap: dict[str, dict[str, str]] = {c: default_pricing_block() for c in METAL_CODES}
    bmap: dict[str, dict[str, str]] = {c: default_buyback_block() for c in METAL_CODES}

    if profile.gold_rate_source == JewellerPricingProfile.GOLD_RATE_MANUAL:
        pmap["gold_22k"] = {
            "mode": MODE_MANUAL_BOARD,
            "markup_percent": "0",
            "markup_inr_per_gram": "0",
            "manual_inr_per_gram": _dec_str(profile.manual_gold_rate_inr_per_gram, "0"),
            "external_api_url": "",
        }
    else:
        has_markup = (
            profile.live_markup_percent != 0 or profile.live_markup_inr_per_gram != 0
        )
        pmap["gold_22k"] = {
            "mode": MODE_MARKUP_ON_CRIDORA if has_markup else MODE_MATCH_CRIDORA,
            "markup_percent": _dec_str(profile.live_markup_percent, "0"),
            "markup_inr_per_gram": _dec_str(profile.live_markup_inr_per_gram, "0"),
            "manual_inr_per_gram": "0",
            "external_api_url": str(profile.gold_rate_external_api_url or "")[:512],
        }

    bmap["gold_22k"] = {
        "deduction_percent": _dec_str(profile.sellback_deduction_percent, "0"),
        "fixed_inr_per_gram": _dec_str(profile.sellback_fixed_inr_per_gram, "0"),
        "jeweller_deduction_inr_per_gram": "0",
    }

    return {"pricing": pmap, "buyback": bmap}
