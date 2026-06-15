"""Fetch Kerala gold rates and serve cached board payloads for the ticker."""

from __future__ import annotations

import logging
import re
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Primary live feed: Jos Alukkas Kerala gold-rate page (admin reference board).
JOSALUKKAS_KERALA_URL = "https://www.josalukkasonline.com/gold-rate-today/kerala/"
JOSALUKKAS_GOLD_URL = "https://www.josalukkasonline.com/gold-rate-today"
# Back-compat alias used in tests/docs.
JOSALUKKAS_KERALA_FALLBACK_URL = JOSALUKKAS_KERALA_URL

_JOSALUKKAS_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
}

_CACHE_KEY = "marketplace_josalukkas_rates_v2"
_CACHE_KEY_LAST_GOOD = "marketplace_josalukkas_rates_last_good_v2"
_CACHE_KEY_FINGERPRINT = "marketplace_josalukkas_rates_fingerprint_v2"
_CACHE_KEY_LAST_FETCH_TS = "marketplace_josalukkas_rates_last_fetch_ts_v2"

_CACHE_TTL = 120
_CACHE_TTL_LAST_GOOD = 86400 * 7
_FETCH_MIN_INTERVAL_SEC = 120

_GOLD_BOARD_KEYS = ("24K", "22K", "18K", "21K")

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
    silver = parsed.get("silver") if isinstance(parsed.get("silver"), dict) else {}
    ts = str(parsed.get("source_updated_at") or "").strip()
    parts = [ts]
    for key in ("24K", "22K", "18K"):
        v = gold.get(key)
        parts.append(str(v) if v is not None else "")
    parts.append(str(silver.get("999")) if silver.get("999") is not None else "")
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

    return {
        "gold": gold,
        "silver": {},
        "source_updated_at": source_updated_at,
        "rate_date": _parse_rate_date(source_updated_at),
        "source": "kerala_gold_rate",
    }


def _http_get_html(url: str, timeout: float = 12.0) -> str | None:
    try:
        req = Request(url, headers=_JOSALUKKAS_HEADERS)
        with urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", "replace")
    except (HTTPError, URLError, TimeoutError, OSError, UnicodeDecodeError):
        return None


def _goodreturns_gold_for_today() -> dict[str, float] | None:
    try:
        from django.utils import timezone

        from .goodreturns_kerala_rates import fetch_goodreturns_gold_for_date
    except ImportError:
        return None

    gold_dec = fetch_goodreturns_gold_for_date(timezone.localdate())
    if not gold_dec or gold_dec.get("22K") is None:
        return None

    gold: dict[str, float] = {}
    for key in _GOLD_BOARD_KEYS:
        val = gold_dec.get(key)
        if val is not None:
            gold[key] = float(val)
    if gold.get("22K") is None:
        return None
    return gold


def _goodreturns_silver_for_today() -> dict[str, float]:
    try:
        from django.utils import timezone

        from .goodreturns_kerala_rates import fetch_goodreturns_silver_for_date
    except ImportError:
        return {}

    silver_dec = fetch_goodreturns_silver_for_date(timezone.localdate())
    if silver_dec is None:
        return {}
    s999 = round(float(silver_dec), 3)
    return {"999": s999, "925": round(s999 * 0.925, 3)}


def _merge_goodreturns_gaps(board: dict) -> dict:
    """
    Keep Jos (or primary) gold/silver; fill only missing keys from Goodreturns Kerala.

    Never overwrites gold values already scraped from Jos Alukkas.
    """
    out = {
        **board,
        "gold": dict(board.get("gold") or {}),
        "silver": dict(board.get("silver") or {}),
    }
    gr_gold = _goodreturns_gold_for_today()
    gr_silver = _goodreturns_silver_for_today()

    if gr_gold:
        for key in _GOLD_BOARD_KEYS:
            if out["gold"].get(key) is None and gr_gold.get(key) is not None:
                out["gold"][key] = gr_gold[key]

    for key in ("999", "925"):
        if out["silver"].get(key) is None and gr_silver.get(key) is not None:
            out["silver"][key] = gr_silver[key]

    gaps: list[str] = []
    if gr_silver and board.get("silver") == {}:
        gaps.append("silver:goodreturns")
    if gr_gold:
        for key in _GOLD_BOARD_KEYS:
            if (board.get("gold") or {}).get(key) is None and out["gold"].get(key) is not None:
                gaps.append(f"gold_{key}:goodreturns")
    if gaps:
        out["gaps_filled_from"] = gaps

    return out


def _fetch_goodreturns_today_parsed() -> dict | None:
    """Full Kerala board from Goodreturns when Jos Alukkas HTML is unavailable."""
    try:
        from django.utils import timezone
    except ImportError:
        return None

    gold = _goodreturns_gold_for_today()
    if not gold or gold.get("22K") is None:
        return None

    silver = _goodreturns_silver_for_today()
    today = timezone.localdate()

    return {
        "gold": gold,
        "silver": silver,
        "source_updated_at": today.isoformat(),
        "rate_date": today.isoformat(),
        "source": "goodreturns_kerala",
    }


def fetch_josalukkas_rates_from_web() -> dict | None:
    """
    Jos Alukkas Kerala first; Goodreturns fills missing silver/gold keys only.

    If Jos is unavailable, fall back to the full Goodreturns Kerala board.
    """
    for url in (JOSALUKKAS_KERALA_URL, JOSALUKKAS_GOLD_URL):
        html = _http_get_html(url)
        if not html:
            continue
        parsed = parse_josalukkas_rates_from_html(html)
        if parsed is not None:
            return _merge_goodreturns_gaps(parsed)
    return _fetch_goodreturns_today_parsed()


def build_spot_payload_from_josalukkas(parsed: dict) -> dict:
    from .public_rate_copy import CRIDORA_LIVE_RATE_NOTE

    gold_src = parsed.get("gold") if isinstance(parsed.get("gold"), dict) else {}
    silver_src = parsed.get("silver") if isinstance(parsed.get("silver"), dict) else {}
    out: dict = {
        "currency": "INR",
        "unit": "per_gram",
        "source": str(parsed.get("source") or "kerala_gold_rate"),
        "note": CRIDORA_LIVE_RATE_NOTE,
        "source_updated_at": str(parsed.get("source_updated_at") or ""),
        "rate_date": str(parsed.get("rate_date") or ""),
        "gold": {str(k): float(v) for k, v in gold_src.items()},
        "silver": {str(k): float(v) for k, v in silver_src.items()},
    }
    gaps = parsed.get("gaps_filled_from")
    if isinstance(gaps, list) and gaps:
        out["gaps_filled_from"] = list(gaps)
    return out


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
    """Fill missing silver from Goodreturns, then international spot as last resort."""
    silver = payload.get("silver") if isinstance(payload.get("silver"), dict) else {}
    if silver.get("999") is not None:
        return payload

    gr_silver = _goodreturns_silver_for_today()
    if gr_silver.get("999") is not None:
        merged = dict(payload)
        merged["silver"] = {**silver, **gr_silver}
        gaps = list(merged.get("gaps_filled_from") or [])
        if "silver:goodreturns" not in gaps:
            gaps.append("silver:goodreturns")
        merged["gaps_filled_from"] = gaps
        return merged

    try:
        from .spot_prices import _build_intl_spot_inr_from_feed

        intl = _build_intl_spot_inr_from_feed()
        if intl and isinstance(intl.get("silver"), dict) and intl["silver"].get("999"):
            merged = dict(payload)
            s999 = float(intl["silver"]["999"])
            merged["silver"] = {
                **silver,
                "999": s999,
                "925": round(s999 * 0.925, 3),
            }
            gaps = list(merged.get("gaps_filled_from") or [])
            if "silver:intl_spot" not in gaps:
                gaps.append("silver:intl_spot")
            merged["gaps_filled_from"] = gaps
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

    now_ts = time.time()
    stored_fp = cache.get(_CACHE_KEY_FINGERPRINT)
    last_good = cache.get(_CACHE_KEY_LAST_GOOD)
    cached = cache.get(_CACHE_KEY)

    if not force_fetch and not _should_fetch_remote(now_ts):
        if _payload_has_22k(cached):
            return cached
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
        refreshed = {**last_good, "source": live_parsed.get("source") or "kerala_gold_rate"}
        refreshed = _enrich_payload_silver(refreshed)
        cache.set(_CACHE_KEY, refreshed, timeout=_CACHE_TTL)
        return refreshed

    _store_payload(live_payload, fingerprint=fingerprint)
    return live_payload


def invalidate_josalukkas_rates_cache() -> None:
    cache.delete(_CACHE_KEY)
    cache.delete(_CACHE_KEY_FINGERPRINT)
    cache.delete(_CACHE_KEY_LAST_FETCH_TS)
