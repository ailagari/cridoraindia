"""Daily 22K reference OHLC table with 1-year retention for charts."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone as py_tz
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils import timezone

from .models import GoldRateDailySnapshot, GoldTickerReferenceHistory

RETENTION_DAYS = 365
DAILY_HISTORY_RANGES = frozenset({"1w", "1m", "6m", "1y"})


def _quantize_inr(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _prev_close_before(day: date) -> Decimal | None:
    prev = (
        GoldRateDailySnapshot.objects.filter(snapshot_date__lt=day)
        .order_by("-snapshot_date")
        .values_list("close_inr", flat=True)
        .first()
    )
    return prev


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


def upsert_daily_from_sample(*, price: Decimal, source: str) -> None:
    """Update today's OHLC row whenever an intraday reference sample is recorded."""
    today = timezone.localdate()
    price_q = _quantize_inr(price)
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


def capture_daily_snapshot(*, price: Decimal, source: str) -> GoldRateDailySnapshot:
    """Idempotent upsert for cron — ensures today is captured even without web traffic."""
    upsert_daily_from_sample(price=price, source=source)
    return GoldRateDailySnapshot.objects.get(snapshot_date=timezone.localdate())


def backfill_daily_from_intraday(*, retention_days: int = RETENTION_DAYS) -> int:
    """Build missing daily rows from sampled intraday history (first deploy / gap fill)."""
    cutoff = timezone.localdate() - timedelta(days=retention_days)
    start_dt = timezone.make_aware(datetime.combine(cutoff, datetime.min.time()))

    samples = (
        GoldTickerReferenceHistory.objects.filter(recorded_at__gte=start_dt)
        .order_by("recorded_at")
        .values("recorded_at", "inr_per_gram_22k", "base_source")
    )

    by_day: dict[date, list[dict]] = {}
    for row in samples:
        ts = row["recorded_at"]
        if timezone.is_naive(ts):
            ts = timezone.make_aware(ts, timezone.get_current_timezone())
        day = timezone.localtime(ts).date()
        if day < cutoff:
            continue
        by_day.setdefault(day, []).append(row)

    created = 0
    for day in sorted(by_day.keys()):
        if GoldRateDailySnapshot.objects.filter(snapshot_date=day).exists():
            continue
        day_rows = by_day[day]
        prices = [_quantize_inr(Decimal(str(r["inr_per_gram_22k"]))) for r in day_rows]
        src = str(day_rows[-1].get("base_source") or "")[:64]
        row = GoldRateDailySnapshot(
            snapshot_date=day,
            open_inr=prices[0],
            high_inr=max(prices),
            low_inr=min(prices),
            close_inr=prices[-1],
            base_source=src,
            sample_count=len(prices),
        )
        _apply_daily_change(row)
        row.save()
        created += 1

    _recompute_changes_after(cutoff)
    return created


def _recompute_changes_after(start_day: date) -> None:
    rows = GoldRateDailySnapshot.objects.filter(snapshot_date__gte=start_day).order_by("snapshot_date")
    for row in rows:
        _apply_daily_change(row)
        row.save(update_fields=["change_inr", "change_pct", "updated_at"])


def prune_gold_rate_history(*, retention_days: int = RETENTION_DAYS) -> dict[str, int]:
    """Delete daily snapshots and intraday samples older than retention window."""
    cutoff_day = timezone.localdate() - timedelta(days=retention_days)
    cutoff_dt = timezone.make_aware(datetime.combine(cutoff_day, datetime.min.time()))

    daily_deleted, _ = GoldRateDailySnapshot.objects.filter(snapshot_date__lt=cutoff_day).delete()
    intraday_deleted, _ = GoldTickerReferenceHistory.objects.filter(recorded_at__lt=cutoff_dt).delete()
    return {"daily_deleted": daily_deleted, "intraday_deleted": intraday_deleted}


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
        f"Rows older than {RETENTION_DAYS} days are removed automatically.",
        "points": points,
    }


def run_daily_gold_rate_maintenance(*, price: Decimal, source: str) -> dict[str, Any]:
    """Cron entry: backfill gaps, capture today, prune stale rows."""
    backfilled = backfill_daily_from_intraday()
    row = capture_daily_snapshot(price=price, source=source)
    pruned = prune_gold_rate_history()
    return {
        "snapshot_date": row.snapshot_date.isoformat(),
        "close_inr": str(row.close_inr),
        "change_inr": str(row.change_inr) if row.change_inr is not None else None,
        "change_pct": str(row.change_pct) if row.change_pct is not None else None,
        "backfilled_days": backfilled,
        "pruned": pruned,
    }
