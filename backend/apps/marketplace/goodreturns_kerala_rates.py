"""Fetch historical Kerala gold/silver ₹/g from Goodreturns (OneIndia DB AJAX)."""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

GOLD_URL = "https://www.goodreturns.in/gold-rates/kerala.html"
SILVER_URL = "https://www.goodreturns.in/silver-rates/kerala.html"

_GOODRETURNS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-IN,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    "X-OIGT-Header": "GITPL",
}

_BACKFILL_LOCK = "kerala_goodreturns_backfill:lock_v1"
_BACKFILL_DONE = "kerala_goodreturns_backfill:done_v1"
_RE_INR = re.compile(r"[\d,]+(?:\.\d+)?")


def parse_goodreturns_inr(raw: str | None) -> Decimal | None:
    if not raw or not isinstance(raw, str):
        return None
    m = _RE_INR.search(raw.replace("\u20b9", "").replace("₹", ""))
    if not m:
        return None
    try:
        v = Decimal(m.group(0).replace(",", ""))
    except (InvalidOperation, ValueError):
        return None
    if v <= 0 or v > 500_000:
        return None
    return v.quantize(Decimal("0.01"))


def _http_get_json(url: str, *, referer: str, timeout: float = 12.0) -> dict | None:
    try:
        req = Request(url, headers={**_GOODRETURNS_HEADERS, "Referer": referer})
        with urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", "replace").strip()
        if not body or body.startswith("<"):
            return None
        data = json.loads(body)
        return data if isinstance(data, dict) else None
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError, UnicodeDecodeError):
        return None


def fetch_goodreturns_gold_for_date(day: date) -> dict[str, Decimal] | None:
    params = urlencode({"gr_db_dynamic_content": "metal_past_price", "date": day.isoformat()})
    data = _http_get_json(f"{GOLD_URL}?{params}", referer=GOLD_URL)
    if not data:
        return None
    k24 = parse_goodreturns_inr(data.get("gold_price_24K"))
    k22 = parse_goodreturns_inr(data.get("gold_price_22K"))
    k18 = parse_goodreturns_inr(data.get("gold_price_18K"))
    if k22 is None and k24 is not None:
        k22 = (k24 * Decimal("0.916")).quantize(Decimal("0.01"))
    if k18 is None and k24 is not None:
        k18 = (k24 * Decimal("0.750")).quantize(Decimal("0.01"))
    if k24 is None and k22 is not None:
        k24 = (k22 / Decimal("0.916")).quantize(Decimal("0.01"))
    if k22 is None:
        return None
    out: dict[str, Decimal] = {"22K": k22}
    if k24 is not None:
        out["24K"] = k24
    if k18 is not None:
        out["18K"] = k18
    return out


def fetch_goodreturns_silver_for_date(day: date) -> Decimal | None:
    params = urlencode({"gr_db_dynamic_content": "metal_past_price", "date": day.isoformat()})
    data = _http_get_json(f"{SILVER_URL}?{params}", referer=SILVER_URL)
    if not data:
        return None
    per_g = parse_goodreturns_inr(data.get("silver_price_1G"))
    if per_g is not None:
        return per_g
    per_kg = parse_goodreturns_inr(data.get("silver_price_1KG"))
    if per_kg is not None:
        return (per_kg / Decimal("1000")).quantize(Decimal("0.01"))
    return None


def upsert_kerala_daily_row(
    *,
    day: date,
    k22: Decimal,
    k18: Decimal | None,
    k24: Decimal | None,
    silver: Decimal | None,
    source: str,
) -> None:
    from .models import AkgsmaBoardDailySnapshot, KeralaGoldRateDaily

    k18_q = (k18 or (k24 * Decimal("0.750") if k24 else k22)).quantize(Decimal("0.01"))
    k24_q = (k24 or (k22 / Decimal("0.916"))).quantize(Decimal("0.01"))
    src = source[:64]

    KeralaGoldRateDaily.objects.update_or_create(
        rate_date=day,
        defaults={
            "inr_per_gram_22k": k22,
            "inr_per_gram_18k": k18_q,
            "inr_per_gram_24k": k24_q,
            "silver_999_inr": silver,
            "source": src,
        },
    )

    snap, created = AkgsmaBoardDailySnapshot.objects.get_or_create(
        snapshot_date=day,
        defaults={
            "open_inr_22k": k22,
            "high_inr_22k": k22,
            "low_inr_22k": k22,
            "close_inr_22k": k22,
            "close_inr_18k": k18_q,
            "close_inr_24k": k24_q,
            "silver_999_inr": silver,
            "board_date": day.isoformat(),
            "source": src,
            "sample_count": 1,
        },
    )
    if not created:
        snap.close_inr_22k = k22
        snap.close_inr_18k = k18_q
        snap.close_inr_24k = k24_q
        if silver is not None:
            snap.silver_999_inr = silver
        snap.source = src
        snap.save(
            update_fields=[
                "close_inr_22k",
                "close_inr_18k",
                "close_inr_24k",
                "silver_999_inr",
                "source",
                "updated_at",
            ]
        )


def backfill_kerala_rates_from_goodreturns(
    *,
    days: int = 730,
    max_fetch: int = 750,
    sleep_sec: float = 0.15,
) -> dict[str, int]:
    """Fetch missing daily Kerala gold/silver rows from Goodreturns (up to 2 years)."""
    from .models import KeralaGoldRateDaily

    if cache.get(_BACKFILL_LOCK):
        return {"skipped": 0, "fetched": 0, "errors": 0, "already": 0}

    cache.set(_BACKFILL_LOCK, True, 3600)
    stats = {"skipped": 0, "fetched": 0, "errors": 0, "already": 0}

    try:
        today = timezone.localdate()
        start = today - timedelta(days=max(1, min(days, 730)))

        existing = set(
            KeralaGoldRateDaily.objects.filter(rate_date__gte=start).values_list("rate_date", flat=True)
        )

        day = start
        fetched = 0
        while day <= today and fetched < max_fetch:
            if day in existing:
                stats["already"] += 1
                day += timedelta(days=1)
                continue

            gold = fetch_goodreturns_gold_for_date(day)
            if gold is None:
                stats["errors"] += 1
                day += timedelta(days=1)
                time.sleep(sleep_sec)
                continue

            silver = fetch_goodreturns_silver_for_date(day)
            upsert_kerala_daily_row(
                day=day,
                k22=gold["22K"],
                k18=gold.get("18K"),
                k24=gold.get("24K"),
                silver=silver,
                source="goodreturns_kerala",
            )
            stats["fetched"] += 1
            fetched += 1
            existing.add(day)
            day += timedelta(days=1)
            time.sleep(sleep_sec)

        if stats["fetched"] == 0 and stats["already"] > 200:
            cache.set(_BACKFILL_DONE, True, 86400 * 30)
    finally:
        cache.delete(_BACKFILL_LOCK)

    logger.info("Kerala Goodreturns backfill: %s", stats)
    return stats


def maybe_backfill_kerala_history(*, min_rows: int = 300, batch_days: int = 60) -> None:
    """Backfill a batch when the archive is still sparse."""
    import sys

    if "test" in sys.argv:
        return

    from .models import KeralaGoldRateDaily

    if cache.get(_BACKFILL_DONE):
        return
    if cache.get(_BACKFILL_LOCK):
        return

    count = KeralaGoldRateDaily.objects.count()
    if count >= min_rows:
        cache.set(_BACKFILL_DONE, True, 86400 * 7)
        return

    backfill_kerala_rates_from_goodreturns(days=730, max_fetch=batch_days)
