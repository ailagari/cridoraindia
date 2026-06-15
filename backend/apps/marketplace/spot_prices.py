"""India-facing INR/g gold ticker from Kerala gold rate feed (admin intl XAU ref optional)."""

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

from .metal_ticker_adjustments import (
    adjusted_inr_from_decimal,
    apply_live_adjustments_to_spot_payload,
)
from .public_rate_copy import (
    CRIDORA_LIVE_RATE_NOTE,
    CRIDORA_LIVE_RATE_STALE_NOTE,
    CRIDORA_MANUAL_RATE_NOTE,
    attach_public_rate_labels,
)
from .models import GoldTickerConfig, get_or_create_ticker

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


def persist_last_good_live_raw_snapshot(raw_payload: dict) -> None:
    gold = raw_payload.get("gold")
    if not isinstance(gold, dict) or gold.get("22K") is None:
        return
    silver_raw = raw_payload.get("silver")
    silver: dict = dict(silver_raw) if isinstance(silver_raw, dict) else {}
    snap = {"gold": dict(gold), "silver": silver}
    t = get_or_create_ticker()
    GoldTickerConfig.objects.filter(pk=t.pk).update(last_good_live_raw_snapshot_json=snap)


def get_raw_spot_payload_for_admin_preview() -> dict:
    """Unadjusted Kerala board INR ladder for admin markup preview (always refreshes feed)."""
    data = refresh_live_kerala_feed(force_fetch=True)
    if data is not None:
        return data
    return {}


def refresh_live_kerala_feed(*, force_fetch: bool = False) -> dict | None:
    """
    Fetch Kerala board rates, persist snapshot, and warm spot caches.

    Runs regardless of manual ticker mode so admins can compare live vs manual board.
    """
    from .josalukkas_rates import get_josalukkas_spot_payload_cached

    data = get_josalukkas_spot_payload_cached(force_fetch=force_fetch)
    if data is None:
        ticker = get_or_create_ticker()
        snap = ticker.last_good_live_raw_snapshot_json
        if isinstance(snap, dict) and isinstance(snap.get("gold"), dict) and snap["gold"].get("22K") is not None:
            data = {
                "currency": "INR",
                "unit": "per_gram",
                "source": "db_snapshot",
                "gold": dict(snap["gold"]),
                "silver": dict(snap["silver"]) if isinstance(snap.get("silver"), dict) else {},
            }
        else:
            stale = cache.get(_CACHE_KEY_LAST_GOOD)
            if stale and isinstance(stale.get("gold"), dict) and stale["gold"].get("22K") is not None:
                data = dict(stale)
            else:
                data = None

    if data is not None and isinstance(data.get("gold"), dict) and data["gold"].get("22K") is not None:
        src = str(data.get("source") or "")
        if src not in ("db_snapshot", "platform_floor"):
            persist_last_good_live_raw_snapshot(data)
        cache.set(_CACHE_KEY_INR, data, timeout=_CACHE_TTL)
        cache.set(_CACHE_KEY_LAST_GOOD, data, timeout=_CACHE_TTL_LAST_GOOD)
    return data


def _attach_kerala_board_from_live(payload: dict, live_feed: dict | None) -> dict:
    """Attach raw Kerala board ladder for admin reference while manual rates are published."""
    if not live_feed:
        return payload
    gold_block = live_feed.get("gold")
    if not isinstance(gold_block, dict) or gold_block.get("22K") is None:
        return payload
    out = dict(payload)
    out["kerala_board"] = {
        "gold": dict(gold_block),
        "silver": dict(live_feed.get("silver") or {}),
        "source": live_feed.get("source"),
        "source_updated_at": live_feed.get("source_updated_at"),
        "rate_date": live_feed.get("rate_date"),
    }
    return out


def invalidate_spot_price_cache(*, force_kerala_refresh: bool = False) -> None:
    cache.delete(_CACHE_KEY_INR)
    if force_kerala_refresh:
        cache.delete(_CACHE_KEY_LAST_GOOD)
    try:
        from .josalukkas_rates import (
            get_josalukkas_spot_payload_cached,
            invalidate_josalukkas_rates_cache,
        )

        invalidate_josalukkas_rates_cache()
        if force_kerala_refresh:
            get_josalukkas_spot_payload_cached(force_fetch=True)
            refresh_live_kerala_feed(force_fetch=True)
    except Exception:
        pass


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


def _build_board_inr_from_feed() -> dict | None:
    from .josalukkas_rates import get_josalukkas_spot_payload_cached

    return get_josalukkas_spot_payload_cached()


def _build_intl_spot_inr_from_feed() -> dict | None:
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


def _kerala_gold_source_label(src: str) -> str:
    if src in ("akgsma_kerala", "kerala_gold_rate", "kerala_gold_rate_stale", "goodreturns_kerala"):
        return src
    return "kerala_gold_rate_stale"


def _resolve_raw_22k_unadjusted() -> tuple[Decimal | None, str]:
    ticker = get_or_create_ticker()
    cached = cache.get(_CACHE_KEY_INR)
    if cached and isinstance(cached.get("gold"), dict):
        v = cached["gold"].get("22K")
        if v is not None:
            return Decimal(str(v)), _kerala_gold_source_label(str(cached.get("source") or ""))

    data = _build_board_inr_from_feed()
    if data is not None and data.get("gold", {}).get("22K") is not None:
        persist_last_good_live_raw_snapshot(data)
        cache.set(_CACHE_KEY_INR, data, timeout=_CACHE_TTL)
        cache.set(_CACHE_KEY_LAST_GOOD, data, timeout=_CACHE_TTL_LAST_GOOD)
        return Decimal(str(data["gold"]["22K"])), _kerala_gold_source_label(
            str(data.get("source") or "")
        )

    stale = cache.get(_CACHE_KEY_LAST_GOOD)
    if stale and isinstance(stale.get("gold"), dict):
        v = stale["gold"].get("22K")
        if v is not None:
            return Decimal(str(v)), "kerala_gold_rate_stale"

    snap = ticker.last_good_live_raw_snapshot_json
    if isinstance(snap, dict):
        gold = snap.get("gold")
        if isinstance(gold, dict):
            v = gold.get("22K")
            if v is not None:
                return Decimal(str(v)), "kerala_gold_rate_stale"

    return None, "none"


def resolve_cridora_base_22k_inr() -> tuple[Decimal, str]:
    """
    Cridora reference 22K ₹/g for jewellers: manual value, or live raw 22K with gold 22K deduction settings,
    else platform fallback (snapshot / legacy reference).
    """
    ticker = get_or_create_ticker()
    if ticker.manual_ticker_enabled and ticker.ticker_manual_22k_inr_per_gram is not None:
        raw = ticker.ticker_manual_22k_inr_per_gram
        if raw > 0:
            return (
                Decimal(str(raw)).quantize(Decimal("0.01")),
                "manual_ticker",
            )

    raw22, src = _resolve_raw_22k_unadjusted()
    if raw22 is not None:
        return adjusted_inr_from_decimal(raw22, family="gold", key="22K", ticker=ticker), src

    return ticker.platform_base_inr_per_gram(), "admin_fallback"


def _finalize_spot_payload(payload: dict, *, include_live_raw: bool) -> dict:
    """Attach optional international raw snapshot (admin-only) + canonical 22K base for ticker APIs."""
    if include_live_raw:
        raw = get_raw_spot_payload_for_admin_preview()
        gold_raw = raw.get("gold") if isinstance(raw.get("gold"), dict) else None
        if gold_raw and gold_raw.get("22K") is not None:
            silver_raw = raw.get("silver") if isinstance(raw.get("silver"), dict) else {}
            entry: dict = {
                "currency": str(raw.get("currency") or "INR"),
                "unit": str(raw.get("unit") or "per_gram"),
                "source": str(raw.get("source") or ""),
                "gold": dict(gold_raw),
                "silver": dict(silver_raw),
            }
            note = str(raw.get("note") or "").strip()
            if note:
                entry["note"] = note
            if raw.get("usd_to_inr") is not None:
                try:
                    entry["usd_to_inr"] = float(raw["usd_to_inr"])
                except (TypeError, ValueError):
                    pass
            if raw.get("usd_to_inr_source"):
                entry["usd_to_inr_source"] = str(raw["usd_to_inr_source"])
            payload["live_raw_spot"] = entry
        else:
            payload["live_raw_spot"] = None
    else:
        payload["live_raw_spot"] = None

    base, src = resolve_cridora_base_22k_inr()
    payload["platform_base_inr_per_gram_22k"] = str(base)
    payload["cridora_base_source"] = src
    try:
        from .gold_price_events import ingest_platform_gold_price

        ingest_platform_gold_price(base=base, source=src)
    except Exception:
        logger.exception("gold price ingest failed")
    return payload


def _positive_manual_rate(value) -> float | None:
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    return v if v > 0 else None


def _manual_ticker_spot_payload(ticker) -> dict:
    k22 = float(ticker.ticker_manual_22k_inr_per_gram)
    k24 = _positive_manual_rate(ticker.ticker_manual_24k_inr_per_gram)
    if k24 is None:
        k24 = k22 / 0.916
    k18 = _positive_manual_rate(ticker.ticker_manual_18k_inr_per_gram)
    if k18 is None:
        k18 = k24 * GOLD_KARAT_PURITY["18K"]
    k24 = round(k24, 2)
    k22_r = round(k22, 2)
    k18_r = round(k18, 2)

    silver: dict[str, float] = {}
    s999 = _positive_manual_rate(ticker.ticker_manual_silver_999_inr_per_gram)
    if s999 is not None:
        s999_r = round(s999, 3)
        silver["999"] = s999_r
        silver["925"] = round(s999_r * SILVER_FINENESS["925"], 3)

    return {
        "currency": "INR",
        "unit": "per_gram",
        "source": "manual_ticker",
        "note": CRIDORA_MANUAL_RATE_NOTE,
        "gold": {
            "24K": k24,
            "22K": k22_r,
            "21K": round(k24 * GOLD_KARAT_PURITY["21K"], 2),
            "18K": k18_r,
        },
        "silver": silver,
    }


def _platform_ticker_fallback_inr() -> dict:
    t = get_or_create_ticker()
    snap = t.last_good_live_raw_snapshot_json
    if (
        isinstance(snap, dict)
        and isinstance(snap.get("gold"), dict)
        and snap["gold"].get("22K") is not None
    ):
        gold_src = snap["gold"]
        silver_src = snap.get("silver") if isinstance(snap.get("silver"), dict) else {}
        raw_payload = {
            "currency": "INR",
            "unit": "per_gram",
            "source": "db_snapshot",
            "note": "Last live raw snapshot — feed and caches empty.",
            "gold": {str(k): float(v) for k, v in gold_src.items()},
            "silver": {str(k): float(v) for k, v in silver_src.items()},
        }
        return apply_live_adjustments_to_spot_payload(raw_payload, t)

    raw22 = float(t.reference_price_inr_per_gram_22k)
    fine = raw22 / 0.916 if raw22 > 0 else 0.0
    raw_payload = {
        "currency": "INR",
        "unit": "per_gram",
        "source": "platform_floor",
        "note": "No snapshot yet — legacy raw 22K-derived ladder with per-metal deductions.",
        "gold": {
            "24K": round(fine, 2),
            "22K": round(raw22, 2),
            "21K": round(fine * GOLD_KARAT_PURITY["21K"], 2),
            "18K": round(fine * GOLD_KARAT_PURITY["18K"], 2),
        },
        "silver": {},
    }
    return apply_live_adjustments_to_spot_payload(raw_payload, t)


def public_spot_prices_payload(*, include_live_raw: bool = False) -> dict:
    """Spot ladder + platform 22K base. International raw ladder only when include_live_raw=True (admin)."""
    live_feed = refresh_live_kerala_feed()
    ticker = get_or_create_ticker()
    if (
        ticker.manual_ticker_enabled
        and ticker.ticker_manual_22k_inr_per_gram is not None
        and ticker.ticker_manual_22k_inr_per_gram > 0
    ):
        manual_payload = _manual_ticker_spot_payload(ticker)
        return _finalize_spot_payload(
            _attach_kerala_board_from_live(manual_payload, live_feed),
            include_live_raw=include_live_raw,
        )

    cached = cache.get(_CACHE_KEY_INR)
    if cached is not None:
        gold_block = cached.get("gold")
        board_raw = dict(gold_block) if isinstance(gold_block, dict) else {}
        payload = apply_live_adjustments_to_spot_payload(cached, ticker)
        if board_raw:
            payload["kerala_board"] = {
                "gold": board_raw,
                "silver": dict(cached.get("silver") or {}),
                "source": cached.get("source"),
                "source_updated_at": cached.get("source_updated_at"),
                "rate_date": cached.get("rate_date"),
            }
        return _finalize_spot_payload(payload, include_live_raw=include_live_raw)

    data = _build_board_inr_from_feed()
    if data is None:
        stale = cache.get(_CACHE_KEY_LAST_GOOD)
        if stale is not None:
            merged = {
                **stale,
                "source": "kerala_gold_rate_stale",
                "note": CRIDORA_LIVE_RATE_STALE_NOTE,
            }
            payload = apply_live_adjustments_to_spot_payload(merged, ticker)
            board_raw = merged.get("gold") if isinstance(merged.get("gold"), dict) else {}
            if board_raw:
                payload["kerala_board"] = {
                    "gold": dict(board_raw),
                    "silver": dict(merged.get("silver") or {}),
                    "source": merged.get("source"),
                    "source_updated_at": merged.get("source_updated_at"),
                    "rate_date": merged.get("rate_date"),
                }
            return _finalize_spot_payload(payload, include_live_raw=include_live_raw)
        return _finalize_spot_payload(
            _platform_ticker_fallback_inr(), include_live_raw=include_live_raw
        )

    persist_last_good_live_raw_snapshot(data)
    cache.set(_CACHE_KEY_INR, data, timeout=_CACHE_TTL)
    cache.set(_CACHE_KEY_LAST_GOOD, data, timeout=_CACHE_TTL_LAST_GOOD)
    payload_out = apply_live_adjustments_to_spot_payload(data, ticker)
    board_raw = data.get("gold") if isinstance(data.get("gold"), dict) else {}
    if board_raw:
        payload_out["kerala_board"] = {
            "gold": dict(board_raw),
            "silver": dict(data.get("silver") or {}),
            "source": data.get("source"),
            "source_updated_at": data.get("source_updated_at"),
            "rate_date": data.get("rate_date"),
        }
    return _finalize_spot_payload(payload_out, include_live_raw=include_live_raw)


class MarketplaceSpotPricesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(attach_public_rate_labels(public_spot_prices_payload(include_live_raw=False)))
