"""Daily 22K reference OHLC table with 1-year retention — updated from live ticker."""

from __future__ import annotations

import time
from datetime import date, datetime, timedelta, timezone as py_tz
from decimal import Decimal
from typing import Any

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from .models import GoldRateDailySnapshot, GoldTickerReferenceHistory

RETENTION_DAYS = 365
_DAILY_DEBOUNCE_KEY = "gold_daily:ticker_debounce_v1"
_PRUNE_CACHE_KEY = "gold_hist:prune_date_v1"


def _quantize_inr(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _prev_close_before(day: date) -> Decimal | None:
    return (
        GoldRateDailySnapshot.objects.filter(snapshot_date__lt=day)
        .order_by("-snapshot_date")
        .values_list("close_inr", flat=True)
        .first()
    )


def _compute_change(close: Decimal, prev_close: Decimal | None) -> tuple[Decimal | None, Decimal | None]:
    if prev_close is None:
        return None, None
    change = _quantize_inr(close - prev_close)
    if prev_close <= 0:
        return change, None
    pct = ((change / prev_close) * Decimal("100")).quantize(Decimal("0.0001"))
    return change, pct


def _apply_daily_change(row: GoldRateDailySnapshot) -> None:
    prev_close = _prev_close_before(row.snapshot_date)
    change_inr, change_pct = _compute_change(row.close_inr, prev_close)
    row.change_inr = change_inr
    row.change_pct = change_pct


def _upsert_today_row(*, price_q: Decimal, source: str) -> None:
    today = timezone.localdate()
    src = (source or "")[:64]

    with transaction.atomic():
        row = GoldRateDailySnapshot.objects.filter(snapshot_date=today).first()
        if row is None:
            row = GoldRateDailySnapshot(
                snapshot_date=today,
                open_inr=price_q,
                high_inr=price_q,
                low_inr=price_q,
                close_inr=price_q,
                base_source=src,
                sample_count=1,
            )
            _apply_daily_change(row)
            row.save()
            return

        row.high_inr = max(row.high_inr, price_q)
        row.low_inr = min(row.low_inr, price_q)
        row.close_inr = price_q
        row.sample_count += 1
        if src:
            row.base_source = src
        _apply_daily_change(row)
        row.save(
            update_fields=[
                "high_inr",
                "low_inr",
                "close_inr",
                "change_inr",
                "change_pct",
                "base_source",
                "sample_count",
                "updated_at",
            ]
        )


def record_live_ticker_daily(*, price: Decimal, source: str) -> None:
    """Persist today's OHLC from the resolved ticker final price (no cron)."""
    now_ts = time.time()
    price_q = _quantize_inr(price)
    price_f = float(price_q)
    today = timezone.localdate()

    deb = cache.get(_DAILY_DEBOUNCE_KEY)
    if deb:
        last_ts, last_day_iso, last_v = deb
        if last_day_iso == today.isoformat() and now_ts - last_ts < 30 and abs(last_v - price_f) < 0.01:
            return

    _upsert_today_row(price_q=price_q, source=source)
    cache.set(_DAILY_DEBOUNCE_KEY, (now_ts, today.isoformat(), price_f), 86400)
    _maybe_prune_throttled()


def _maybe_prune_throttled() -> None:
    today_key = timezone.localdate().isoformat()
    if cache.get(_PRUNE_CACHE_KEY) == today_key:
        return
    cutoff_day = timezone.localdate() - timedelta(days=RETENTION_DAYS)
    cutoff_dt = timezone.make_aware(datetime.combine(cutoff_day, datetime.min.time()))
    GoldRateDailySnapshot.objects.filter(snapshot_date__lt=cutoff_day).delete()
    GoldTickerReferenceHistory.objects.filter(recorded_at__lt=cutoff_dt).delete()
    cache.set(_PRUNE_CACHE_KEY, today_key, 86400 * 2)


def _date_to_iso(day: date) -> str:
    dt = datetime(day.year, day.month, day.day, tzinfo=py_tz.utc)
    return dt.isoformat().replace("+00:00", "Z")


def fetch_daily_history_payload(*, range_key: str) -> dict[str, Any]:
    from .gold_ticker_history import RANGE_WINDOWS, normalize_range_param

    rk = normalize_range_param(range_key)
    window = RANGE_WINDOWS[rk]
    start_day = timezone.localdate() - window

    rows = list(
        GoldRateDailySnapshot.objects.filter(snapshot_date__gte=start_day).order_by("snapshot_date")
    )

    points: list[dict[str, str | None]] = []
    for row in rows:
        pt: dict[str, str | None] = {
            "t": _date_to_iso(row.snapshot_date),
            "v": str(row.close_inr),
            "open": str(row.open_inr),
            "high": str(row.high_inr),
            "low": str(row.low_inr),
            "src": str(row.base_source or ""),
        }
        if row.change_inr is not None:
            pt["change_inr"] = str(row.change_inr)
        if row.change_pct is not None:
            pt["change_pct"] = str(row.change_pct)
        points.append(pt)

    return {
        "range": rk,
        "granularity": "daily",
        "window_hours": round(window.total_seconds() / 3600, 4),
        "retention_days": RETENTION_DAYS,
        "note": "Daily 22K ₹/g reference (open/high/low/close) with day-over-day change. "
        "Updated live from the ticker final price; rows older than one year are removed automatically.",
        "points": points,
    }
