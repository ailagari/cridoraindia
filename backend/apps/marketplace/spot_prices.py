"""India-facing INR/g gold ticker from global XAU spot + USD→INR (indicative, not IBJA)."""

from __future__ import annotations

import json
import logging
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import get_or_create_ticker

TROY_OZ_TO_GRAMS = 31.1035

# 22K uses BIS 916 (91.6%) fine fraction; 24K uses full fine spot.
GOLD_KARAT_PURITY = {
    "24K": 1.0,
    "22K": 0.916,
    "21K": 0.875,
    "18K": 0.750,
}

SILVER_FINENESS = {
    "999": 1.0,
    "925": 0.925,
}

logger = logging.getLogger(__name__)

_CACHE_KEY_INR = "marketplace_spot_prices_inr"
_CACHE_TTL = 30
_CACHE_KEY_LAST_GOOD = "marketplace_spot_prices_inr_last_good"
_CACHE_TTL_LAST_GOOD = 86400 * 7


def invalidate_spot_price_cache() -> None:
    cache.delete(_CACHE_KEY_INR)

DEFAULT_USD_INR = Decimal("83")
CACHE_KEY_USD_INR = "marketplace_fx_usd_inr_frankfurter"
CACHE_TTL_USD_INR = 3600

GOLD_API_XAU = "https://api.gold-api.com/price/XAU"
GOLD_API_XAG = "https://api.gold-api.com/price/XAG"
FRANKFURTER_USD_INR = "https://api.frankfurter.app/latest?from=USD&to=INR"


def _http_get_json(url: str, timeout: float = 8.0) -> dict | None:
    try:
        req = Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; CridoraIndia/1.0)"},
        )
        with urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, TypeError, ValueError, OSError):
        return None


def _usd_to_inr() -> tuple[float, str]:
    cached = cache.get(CACHE_KEY_USD_INR)
    if cached is not None:
        try:
            v = float(cached)
            if v > 0:
                return v, "cached"
        except (TypeError, ValueError):
            pass

    data = _http_get_json(FRANKFURTER_USD_INR, timeout=6.0)
    if not data:
        return float(DEFAULT_USD_INR), "default_fallback"
    try:
        rate = float(data["rates"]["INR"])
        if rate <= 70 or rate > 120:
            return float(DEFAULT_USD_INR), "default_fallback"
        cache.set(CACHE_KEY_USD_INR, rate, timeout=CACHE_TTL_USD_INR)
        return rate, "frankfurter"
    except (KeyError, TypeError, ValueError):
        return float(DEFAULT_USD_INR), "default_fallback"


def _build_spot_inr_from_feed() -> dict | None:
    gold_data = _http_get_json(GOLD_API_XAU, timeout=8.0)
    if not gold_data:
        return None
    try:
        gold_usd_per_oz = float(gold_data["price"])
    except (KeyError, TypeError, ValueError):
        return None
    if gold_usd_per_oz <= 0:
        return None

    usd_inr, fx_src = _usd_to_inr()
    gold_per_gram_inr = (gold_usd_per_oz / TROY_OZ_TO_GRAMS) * usd_inr

    silver_block: dict[str, float] = {}
    silver_data = _http_get_json(GOLD_API_XAG, timeout=8.0)
    if silver_data:
        try:
            silver_usd_per_oz = float(silver_data["price"])
            if silver_usd_per_oz > 0:
                silver_per_gram_inr = (silver_usd_per_oz / TROY_OZ_TO_GRAMS) * usd_inr
                silver_block = {
                    k: round(silver_per_gram_inr * purity, 3)
                    for k, purity in SILVER_FINENESS.items()
                }
        except (KeyError, TypeError, ValueError):
            silver_block = {}

    return {
        "currency": "INR",
        "unit": "per_gram",
        "source": "spot",
        "note": "Global spot (XAU / XAG) converted to INR per gram — indicative reference; not IBJA.",
        "usd_to_inr": round(usd_inr, 6),
        "usd_to_inr_source": fx_src,
        "gold": {
            karat: round(gold_per_gram_inr * purity, 2)
            for karat, purity in GOLD_KARAT_PURITY.items()
        },
        "silver": silver_block,
    }


def _apply_cridora_live_markup_to_spot_payload(raw_payload: dict, ticker) -> dict:
    """
    Raw spot payloads carry unadjusted 22K; Cridora reference = raw 22K after admin % and ₹/g.
    Does not apply to manual ticker or platform_floor payloads (already final).
    """
    gold = raw_payload.get("gold")
    if not isinstance(gold, dict) or gold.get("22K") is None:
        return raw_payload
    src = str(raw_payload.get("source") or "")
    if src in ("manual_ticker", "platform_floor"):
        return raw_payload
    raw22 = Decimal(str(gold["22K"]))
    adj22_dec = ticker.apply_admin_live_markup_to_raw_22k(raw22)
    adj22 = float(adj22_dec)
    if adj22 <= 0:
        return raw_payload
    fine = adj22 / 0.916
    new_gold = {
        "24K": round(fine, 2),
        "22K": round(adj22, 2),
        "21K": round(fine * GOLD_KARAT_PURITY["21K"], 2),
        "18K": round(fine * GOLD_KARAT_PURITY["18K"], 2),
    }
    base_note = str(raw_payload.get("note") or "").strip()
    extra = "Cridora reference = live spot 22K after admin % and ₹/g adjustment."
    note = f"{base_note} {extra}".strip()
    return {**raw_payload, "gold": new_gold, "note": note}


def resolve_cridora_base_22k_inr() -> tuple[Decimal, str]:
    """
    Single source of truth for platform 22K ₹/g (Cridora reference for jewellers):
    manual ticker value if enabled; else raw spot (cache / feed / stale) with admin % and ₹/g;
    else emergency raw from config with the same adjustments.
    """
    ticker = get_or_create_ticker()
    if ticker.manual_ticker_enabled and ticker.ticker_manual_22k_inr_per_gram is not None:
        raw = ticker.ticker_manual_22k_inr_per_gram
        if raw > 0:
            return Decimal(str(raw)).quantize(Decimal("0.01")), "manual_ticker"

    cached = cache.get(_CACHE_KEY_INR)
    if cached and isinstance(cached.get("gold"), dict):
        v = cached["gold"].get("22K")
        if v is not None:
            raw = Decimal(str(v))
            return ticker.apply_admin_live_markup_to_raw_22k(raw), "live_spot"

    data = _build_spot_inr_from_feed()
    if data is not None and data.get("gold", {}).get("22K") is not None:
        d_raw = Decimal(str(data["gold"]["22K"]))
        cache.set(_CACHE_KEY_INR, data, timeout=_CACHE_TTL)
        cache.set(_CACHE_KEY_LAST_GOOD, data, timeout=_CACHE_TTL_LAST_GOOD)
        return ticker.apply_admin_live_markup_to_raw_22k(d_raw), "live_spot"

    stale = cache.get(_CACHE_KEY_LAST_GOOD)
    if stale and isinstance(stale.get("gold"), dict):
        v = stale["gold"].get("22K")
        if v is not None:
            raw = Decimal(str(v))
            return ticker.apply_admin_live_markup_to_raw_22k(raw), "stale_spot_cache"

    return ticker.platform_base_inr_per_gram(), "admin_fallback"


def _manual_ticker_spot_payload(ticker) -> dict:
    k22 = float(ticker.ticker_manual_22k_inr_per_gram)
    if ticker.ticker_manual_24k_inr_per_gram is not None and float(
        ticker.ticker_manual_24k_inr_per_gram
    ) > 0:
        k24 = float(ticker.ticker_manual_24k_inr_per_gram)
    else:
        k24 = k22 / 0.916
    k24 = round(k24, 2)
    k22_r = round(k22, 2)
    return {
        "currency": "INR",
        "unit": "per_gram",
        "source": "manual_ticker",
        "note": "Admin-set ticker rates (override global spot for platform 22K base and public ticker).",
        "gold": {
            "24K": k24,
            "22K": k22_r,
            "21K": round(k24 * GOLD_KARAT_PURITY["21K"], 2),
            "18K": round(k24 * GOLD_KARAT_PURITY["18K"], 2),
        },
        "silver": {},
    }


def _platform_ticker_fallback_inr() -> dict:
    t = get_or_create_ticker()
    base_22 = float(t.platform_base_inr_per_gram())
    fine = base_22 / 0.916 if base_22 > 0 else 0.0
    silver: dict[str, float] = {}
    return {
        "currency": "INR",
        "unit": "per_gram",
        "source": "platform_floor",
        "note": "Emergency Cridora reference — global spot feed unavailable; raw substitute plus admin adjustments.",
        "gold": {
            "24K": round(fine, 2),
            "22K": round(base_22, 2),
            "21K": round(fine * 0.875, 2),
            "18K": round(fine * 0.750, 2),
        },
        "silver": silver,
    }


def public_spot_prices_payload() -> dict:
    """Same JSON shape as MarketplaceSpotPricesView (AllowAny)."""
    ticker = get_or_create_ticker()
    if (
        ticker.manual_ticker_enabled
        and ticker.ticker_manual_22k_inr_per_gram is not None
        and ticker.ticker_manual_22k_inr_per_gram > 0
    ):
        return _manual_ticker_spot_payload(ticker)

    cached = cache.get(_CACHE_KEY_INR)
    if cached is not None:
        return _apply_cridora_live_markup_to_spot_payload(cached, ticker)

    data = _build_spot_inr_from_feed()
    if data is None:
        stale = cache.get(_CACHE_KEY_LAST_GOOD)
        if stale is not None:
            merged = {
                **stale,
                "source": "stale_cache",
                "note": "Last successful spot conversion — feed temporarily unavailable.",
            }
            return _apply_cridora_live_markup_to_spot_payload(merged, ticker)
        return _platform_ticker_fallback_inr()

    cache.set(_CACHE_KEY_INR, data, timeout=_CACHE_TTL)
    cache.set(_CACHE_KEY_LAST_GOOD, data, timeout=_CACHE_TTL_LAST_GOOD)
    payload_out = _apply_cridora_live_markup_to_spot_payload(data, ticker)
    try:
        from .gold_rate_alerts import maybe_notify_gold_rate_move

        maybe_notify_gold_rate_move()
    except Exception:
        logger.exception("Gold rate alert check failed after spot refresh")
    return payload_out


class MarketplaceSpotPricesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(public_spot_prices_payload())
