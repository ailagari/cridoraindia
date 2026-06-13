"""Fetch Kerala gold rates and serve cached board payloads for the ticker."""

from __future__ import annotations

import logging
import re
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Primary live feed: Jos Alukkas India gold-rate page (same rates shown on Kerala storefront).
JOSALUKKAS_GOLD_URL = "https://www.josalukkasonline.com/gold-rate-today"
JOSALUKKAS_KERALA_FALLBACK_URL = "https://www.josalukkasonline.com/gold-rate-today/kerala/"

_CACHE_KEY = "marketplace_josalukkas_rates_v2"
_CACHE_KEY_LAST_GOOD = "marketplace_josalukkas_rates_last_good_v2"
_CACHE_KEY_FINGERPRINT = "marketplace_josalukkas_rates_fingerprint_v2"
_CACHE_KEY_LAST_FETCH_TS = "marketplace_josalukkas_rates_last_fetch_ts_v2"

_CACHE_TTL = 120
_CACHE_TTL_LAST_GOOD = 86400 * 7
_FETCH_MIN_INTERVAL_SEC = 120

_RE_UPDATED = re.compile(
    r"Updated\s+on:\s*<strong[^>]*>\s*([^<]+?)\s*</strong>",
    re.IGNORECASE,
)
_RE_CARAT_CARD = re.compile(
    r'class="carat-card[^"]*"[^>]*>.*?'
    r'class="karat[^"]*">\s*(?P<karat>24|22|18)K\s+Gold\s*</span>.*?'
    r'class="amount[^"]*">\s*₹\s*(?P<amt>[\d,]+)',
    re.IGNORECASE | re.DOTALL,
)
def _parse_inr_amount(raw: str) -> float | None:
    try:
        v = float(str(raw).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    if v <= 0 or v > 50000:
        return None
    return round(v, 2)


def _parse_rate_date(updated_text: str) -> str:
    m = re.search(r"(\d{2})-(\d{2})-(\d{2})", updated_text or "")
    if not m:
        return ""
    dd, mm, yy = m.group(1), m.group(2), m.group(3)
    try:
        century = 2000 + int(yy)
        return date(century, int(mm), int(dd)).isoformat()
    except ValueError:
        return ""


def _payload_fingerprint(parsed: dict) -> str:
    gold = parsed.get("gold") if isinstance(parsed.get("gold"), dict) else {}
    ts = str(parsed.get("source_updated_at") or "").strip()
    parts = [ts]
    for key in ("24K", "22K", "18K"):
        v = gold.get(key)
        parts.append(str(v) if v is not None else "")
    return "|".join(parts)


def parse_josalukkas_rates_from_html(html: str) -> dict | None:
    """Parse 24K/22K/18K ₹/g and source update fingerprint from Jos Alukkas gold rate HTML."""
    if not html or not isinstance(html, str):
        return None

    updated_m = _RE_UPDATED.search(html)
    if not updated_m:
        return None
    source_updated_at = updated_m.group(1).strip()

    gold: dict[str, float] = {}
    for m in _RE_CARAT_CARD.finditer(html):
        karat = f"{m.group('karat')}K"
        amt = _parse_inr_amount(m.group("amt"))
        if amt is not None:
            gold[karat] = amt

    if gold.get("22K") is None:
        return None

    if gold.get("24K") is None and gold.get("22K") is not None:
        gold["24K"] = round(gold["22K"] / 0.916, 2)
    if gold.get("18K") is None and gold.get("24K") is not None:
        gold["18K"] = round(gold["24K"] * 0.750, 2)

    k24 = gold.get("24K")
    if k24 is not None:
        gold.setdefault("21K", round(k24 * 0.875, 2))

    return {
        "gold": gold,
        "silver": {},
        "source_updated_at": source_updated_at,
        "rate_date": _parse_rate_date(source_updated_at),
        "source": "kerala_gold_rate",
    }


def _http_get_html(url: str, timeout: float = 12.0) -> str | None:
    try:
        req = Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; CridoraIndia/1.0)"},
        )
        with urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", "replace")
    except (HTTPError, URLError, TimeoutError, OSError, UnicodeDecodeError):
        return None


def fetch_josalukkas_rates_from_web() -> dict | None:
    for url in (JOSALUKKAS_GOLD_URL, JOSALUKKAS_KERALA_FALLBACK_URL):
        html = _http_get_html(url)
        if not html:
            continue
        parsed = parse_josalukkas_rates_from_html(html)
        if parsed is not None:
            return parsed
    return None


def build_spot_payload_from_josalukkas(parsed: dict) -> dict:
    gold_src = parsed.get("gold") if isinstance(parsed.get("gold"), dict) else {}
    silver_src = parsed.get("silver") if isinstance(parsed.get("silver"), dict) else {}
    return {
        "currency": "INR",
        "unit": "per_gram",
        "source": str(parsed.get("source") or "kerala_gold_rate"),
        "note": "Jos Alukkas gold rate (24K / 22K / 18K) — indicative India reference.",
        "source_updated_at": str(parsed.get("source_updated_at") or ""),
        "rate_date": str(parsed.get("rate_date") or ""),
        "gold": {str(k): float(v) for k, v in gold_src.items()},
        "silver": {str(k): float(v) for k, v in silver_src.items()},
    }


def _payload_has_22k(payload: dict | None) -> bool:
    if not payload or not isinstance(payload.get("gold"), dict):
        return False
    return payload["gold"].get("22K") is not None


def _db_stale_payload() -> dict | None:
    try:
        from .kerala_board_history import latest_board_rates_payload
    except ImportError:
        return None
    return latest_board_rates_payload(source_prefix="kerala_gold")


def _enrich_payload_silver(payload: dict) -> dict:
    silver = payload.get("silver") if isinstance(payload.get("silver"), dict) else {}
    if silver.get("999") is not None:
        return payload
    try:
        from .spot_prices import _build_intl_spot_inr_from_feed

        intl = _build_intl_spot_inr_from_feed()
        if intl and isinstance(intl.get("silver"), dict) and intl["silver"].get("999"):
            merged = dict(payload)
            merged["silver"] = {**silver, "999": intl["silver"]["999"]}
            return merged
    except Exception:
        pass
    return payload


def _should_fetch_remote(now_ts: float) -> bool:
    last_fetch = cache.get(_CACHE_KEY_LAST_FETCH_TS)
    if last_fetch is None:
        return True
    try:
        return (now_ts - float(last_fetch)) >= _FETCH_MIN_INTERVAL_SEC
    except (TypeError, ValueError):
        return True


def _store_payload(payload: dict, *, fingerprint: str) -> None:
    payload = _enrich_payload_silver(payload)
    cache.set(_CACHE_KEY, payload, timeout=_CACHE_TTL)
    cache.set(_CACHE_KEY_LAST_GOOD, payload, timeout=_CACHE_TTL_LAST_GOOD)
    cache.set(_CACHE_KEY_FINGERPRINT, fingerprint, timeout=_CACHE_TTL_LAST_GOOD)
    try:
        from .kerala_board_history import record_kerala_board_rates

        record_kerala_board_rates(payload)
    except Exception:
        logger.exception("kerala board history record failed")


def get_josalukkas_spot_payload_cached(*, force_fetch: bool = False) -> dict | None:
    """
    Cached Kerala gold rates.

    Stored values are refreshed only when the page's "Updated on" fingerprint changes
    (or on first fetch). Between source updates we serve the last stored payload.
    """
    import time

    cached = cache.get(_CACHE_KEY)
    if _payload_has_22k(cached) and not force_fetch:
        return cached

    now_ts = time.time()
    stored_fp = cache.get(_CACHE_KEY_FINGERPRINT)
    last_good = cache.get(_CACHE_KEY_LAST_GOOD)

    if not force_fetch and not _should_fetch_remote(now_ts):
        if _payload_has_22k(last_good):
            stale = {**last_good, "source": "kerala_gold_rate_stale"}
            cache.set(_CACHE_KEY, stale, timeout=_CACHE_TTL)
            return stale
        db_payload = _db_stale_payload()
        if _payload_has_22k(db_payload):
            cache.set(_CACHE_KEY, db_payload, timeout=_CACHE_TTL)
            return db_payload
        return None

    cache.set(_CACHE_KEY_LAST_FETCH_TS, now_ts, timeout=_FETCH_MIN_INTERVAL_SEC + 60)

    live_parsed = fetch_josalukkas_rates_from_web()
    if live_parsed is None:
        if _payload_has_22k(last_good):
            stale = {**last_good, "source": "kerala_gold_rate_stale"}
            cache.set(_CACHE_KEY, stale, timeout=_CACHE_TTL)
            return stale
        db_payload = _db_stale_payload()
        if _payload_has_22k(db_payload):
            cache.set(_CACHE_KEY, db_payload, timeout=_CACHE_TTL)
            return db_payload
        return None

    fingerprint = _payload_fingerprint(live_parsed)
    live_payload = build_spot_payload_from_josalukkas(live_parsed)

    if stored_fp and fingerprint and fingerprint == stored_fp and _payload_has_22k(last_good):
        refreshed = {**last_good, "source": "kerala_gold_rate"}
        cache.set(_CACHE_KEY, refreshed, timeout=_CACHE_TTL)
        return refreshed

    _store_payload(live_payload, fingerprint=fingerprint)
    return live_payload


def invalidate_josalukkas_rates_cache() -> None:
    cache.delete(_CACHE_KEY)
    cache.delete(_CACHE_KEY_FINGERPRINT)
    cache.delete(_CACHE_KEY_LAST_FETCH_TS)
