"""Persist sampled Kerala board ₹/g for charts."""

from __future__ import annotations

import math
import time
from datetime import date, timedelta, timezone as py_tz
from decimal import Decimal
from typing import Any

from django.core.cache import cache
from django.db.models import Max, Min
from django.utils import timezone

from .models import AkgsmaBoardDailySnapshot, AkgsmaBoardRateHistory, KeralaGoldRateDaily

_DEBOUNCE_KEY = "kerala_board_hist:debounce_v1"
_RETENTION_DAYS = 730
_PRUNE_CACHE_KEY = "kerala_board_hist:prune_date_v1"

BOARD_RANGE_WINDOWS: dict[str, timedelta] = {
    "1d": timedelta(days=1),
    "1w": timedelta(days=7),
    "1m": timedelta(days=30),
    "3m": timedelta(days=90),
    "6m": timedelta(days=180),
    "1y": timedelta(days=365),
    "2y": timedelta(days=730),
}

BOARD_RANGE_ALIAS: dict[str, str] = {
    "day": "1d",
    "d": "1d",
    "24h": "1d",
    "week": "1w",
    "w": "1w",
    "month": "1m",
    "m": "1m",
    "3month": "3m",
    "3mth": "3m",
    "6month": "6m",
    "6mth": "6m",
    "year": "1y",
    "y": "1y",
    "2year": "2y",
    "max": "2y",
}


def normalize_board_range_param(raw: str) -> str:
    key = (raw or "1m").strip().lower()
    key = BOARD_RANGE_ALIAS.get(key, key)
    return key if key in BOARD_RANGE_WINDOWS else "1m"


def normalize_board_metal_param(raw: str) -> str:
    key = (raw or "22K").strip()
    if key.lower() in ("silver", "silver999", "999"):
        return "silver999"
    if key in ("18K", "22K", "24K"):
        return key
    return "22K"


def _gold_val(payload: dict, key: str) -> Decimal | None:
    gold = payload.get("gold")
    if not isinstance(gold, dict):
        return None
    v = gold.get(key)
    if v is None:
        return None
    try:
        return Decimal(str(v)).quantize(Decimal("0.01"))
    except Exception:
        return None


def _silver_val(payload: dict) -> Decimal | None:
    silver = payload.get("silver")
    if not isinstance(silver, dict):
        return None
    v = silver.get("999")
    if v is None:
        return None
    try:
        return Decimal(str(v)).quantize(Decimal("0.01"))
    except Exception:
        return None


def record_kerala_board_rates(payload: dict) -> None:
    """Append intraday + daily OHLC when board rates change or on interval."""
    k22 = _gold_val(payload, "22K")
    if k22 is None:
        return
    k18 = _gold_val(payload, "18K")
    k24 = _gold_val(payload, "24K")
    silver = _silver_val(payload)
    src = str(payload.get("source") or "kerala_gold_rate")[:64]
    board_date = str(payload.get("rate_date") or "")[:32]

    now_ts = time.time()
    k22_f = float(k22)
    deb = cache.get(_DEBOUNCE_KEY)
    if deb:
        last_ts, last_v = deb
        if now_ts - last_ts < 60 and abs(last_v - k22_f) < 0.12:
            _record_daily(k22=k22, k18=k18, k24=k24, silver=silver, src=src, board_date=board_date)
            return

    last_row = (
        AkgsmaBoardRateHistory.objects.order_by("-recorded_at")
        .only("recorded_at", "inr_per_gram_22k")
        .first()
    )
    if last_row is not None:
        age = (timezone.now() - last_row.recorded_at).total_seconds()
        if age < 300 and abs(float(last_row.inr_per_gram_22k) - k22_f) < 0.20:
            cache.set(_DEBOUNCE_KEY, (now_ts, k22_f), 3600)
            _record_daily(k22=k22, k18=k18, k24=k24, silver=silver, src=src, board_date=board_date)
            return

    AkgsmaBoardRateHistory.objects.create(
        inr_per_gram_22k=k22,
        inr_per_gram_18k=k18,
        inr_per_gram_24k=k24,
        silver_999_inr=silver,
        board_date=board_date,
        source=src,
    )
    cache.set(_DEBOUNCE_KEY, (now_ts, k22_f), 3600)
    _record_daily(k22=k22, k18=k18, k24=k24, silver=silver, src=src, board_date=board_date)
    try:
        from .goodreturns_kerala_rates import maybe_backfill_kerala_history

        maybe_backfill_kerala_history()
    except Exception:
        pass


def _record_daily(
    *,
    k22: Decimal,
    k18: Decimal | None,
    k24: Decimal | None,
    silver: Decimal | None,
    src: str,
    board_date: str,
) -> None:
    today = timezone.localdate()
    row, created = AkgsmaBoardDailySnapshot.objects.get_or_create(
        snapshot_date=today,
        defaults={
            "open_inr_22k": k22,
            "high_inr_22k": k22,
            "low_inr_22k": k22,
            "close_inr_22k": k22,
            "close_inr_18k": k18,
            "close_inr_24k": k24,
            "silver_999_inr": silver,
            "board_date": board_date,
            "source": src,
            "sample_count": 1,
        },
    )
    if created:
        _upsert_kerala_gold_rate_daily(row)
        _maybe_prune_old_rows()
        return
    row.high_inr_22k = max(row.high_inr_22k, k22)
    row.low_inr_22k = min(row.low_inr_22k, k22)
    row.close_inr_22k = k22
    if k18 is not None:
        row.close_inr_18k = k18
    if k24 is not None:
        row.close_inr_24k = k24
    if silver is not None:
        row.silver_999_inr = silver
    row.board_date = board_date or row.board_date
    row.source = src
    row.sample_count = (row.sample_count or 0) + 1
    row.save(
        update_fields=[
            "high_inr_22k",
            "low_inr_22k",
            "close_inr_22k",
            "close_inr_18k",
            "close_inr_24k",
            "silver_999_inr",
            "board_date",
            "source",
            "sample_count",
            "updated_at",
        ]
    )
    _upsert_kerala_gold_rate_daily(row)
    _maybe_prune_old_rows()


def _upsert_kerala_gold_rate_daily(row: AkgsmaBoardDailySnapshot) -> None:
    if row.close_inr_22k is None:
        return
    k18 = row.close_inr_18k or (row.close_inr_24k * Decimal("0.750") if row.close_inr_24k else row.close_inr_22k)
    k24 = row.close_inr_24k or (row.close_inr_22k / Decimal("0.916")).quantize(Decimal("0.01"))
    KeralaGoldRateDaily.objects.update_or_create(
        rate_date=row.snapshot_date,
        defaults={
            "inr_per_gram_22k": row.close_inr_22k,
            "inr_per_gram_18k": k18.quantize(Decimal("0.01")),
            "inr_per_gram_24k": k24.quantize(Decimal("0.01")),
            "silver_999_inr": row.silver_999_inr,
            "source": row.source or "kerala_board",
        },
    )


def _maybe_prune_old_rows() -> None:
    today = timezone.localdate()
    if cache.get(_PRUNE_CACHE_KEY) == today.isoformat():
        return
    cutoff = today - timedelta(days=_RETENTION_DAYS)
    AkgsmaBoardDailySnapshot.objects.filter(snapshot_date__lt=cutoff).delete()
    AkgsmaBoardRateHistory.objects.filter(recorded_at__lt=timezone.now() - timedelta(days=90)).delete()
    KeralaGoldRateDaily.objects.filter(rate_date__lt=cutoff).delete()
    cache.set(_PRUNE_CACHE_KEY, today.isoformat(), 86400)


def _daily_value_for_metal(row: AkgsmaBoardDailySnapshot, metal: str) -> Decimal | None:
    if metal == "18K":
        return row.close_inr_18k
    if metal == "24K":
        return row.close_inr_24k
    if metal == "silver999":
        return row.silver_999_inr
    return row.close_inr_22k


def _intraday_value_for_metal(row: AkgsmaBoardRateHistory, metal: str) -> Decimal | None:
    if metal == "18K":
        return row.inr_per_gram_18k
    if metal == "24K":
        return row.inr_per_gram_24k
    if metal == "silver999":
        return row.silver_999_inr
    return row.inr_per_gram_22k


def _kerala_daily_value(row: KeralaGoldRateDaily, metal: str) -> Decimal | None:
    if metal == "18K":
        return row.inr_per_gram_18k
    if metal == "24K":
        return row.inr_per_gram_24k
    if metal == "silver999":
        return row.silver_999_inr
    return row.inr_per_gram_22k


def fetch_board_history_payload(*, range_key: str, metal: str = "22K", max_points: int = 900) -> dict[str, Any]:
    rk = normalize_board_range_param(range_key)
    mk = normalize_board_metal_param(metal)
    window = BOARD_RANGE_WINDOWS[rk]

    if rk == "1d":
        start = timezone.now() - window
        qs = AkgsmaBoardRateHistory.objects.filter(recorded_at__gte=start).order_by("recorded_at")
        rows = list(qs)
        if len(rows) > max_points:
            step = int(math.ceil(len(rows) / max_points))
            rows = rows[::step]
        points: list[dict[str, str]] = []
        for r in rows:
            val = _intraday_value_for_metal(r, mk)
            if val is None:
                continue
            ts = r.recorded_at
            if timezone.is_naive(ts):
                ts = timezone.make_aware(ts, timezone.get_current_timezone())
            points.append(
                {
                    "t": ts.astimezone(py_tz.utc).isoformat().replace("+00:00", "Z"),
                    "v": str(val.quantize(Decimal("0.01"))),
                }
            )
        return {
            "range": rk,
            "metal": mk,
            "granularity": "intraday",
            "retention_days": _RETENTION_DAYS,
            "note": "Kerala board indicative ₹/g — sampled when published rates change.",
            "points": points,
        }

    start_day = timezone.localdate() - window
    qs = KeralaGoldRateDaily.objects.filter(rate_date__gte=start_day).order_by("rate_date")
    rows = list(qs)
    if len(rows) > max_points:
        step = int(math.ceil(len(rows) / max_points))
        rows = rows[::step]
    points = []
    for r in rows:
        val = _kerala_daily_value(r, mk)
        if val is None:
            continue
        pt: dict[str, Any] = {
            "t": r.rate_date.isoformat(),
            "v": str(val.quantize(Decimal("0.01"))),
        }
        snap = AkgsmaBoardDailySnapshot.objects.filter(snapshot_date=r.rate_date).first()
        if snap and mk == "22K":
            pt["open"] = str(snap.open_inr_22k.quantize(Decimal("0.01")))
            pt["high"] = str(snap.high_inr_22k.quantize(Decimal("0.01")))
            pt["low"] = str(snap.low_inr_22k.quantize(Decimal("0.01")))
        points.append(pt)
    for i in range(1, len(points)):
        try:
            prev = Decimal(points[i - 1]["v"])
            cur = Decimal(points[i]["v"])
            ch = (cur - prev).quantize(Decimal("0.01"))
            pct = ((ch / prev) * Decimal("100")).quantize(Decimal("0.0001")) if prev > 0 else None
            points[i]["change_inr"] = str(ch)
            if pct is not None:
                points[i]["change_pct"] = str(pct)
        except Exception:
            pass

    return {
        "range": rk,
        "metal": mk,
        "granularity": "daily",
        "retention_days": _RETENTION_DAYS,
        "note": "Daily Kerala gold/silver close ₹/g — up to 2 years stored; today updates with Jos Alukkas live ticker.",
        "points": [{k: v for k, v in pt.items() if v is not None} for pt in points],
    }


def fetch_board_daily_table(*, limit: int = 60, offset: int = 0) -> dict[str, Any]:
    limit = max(1, min(int(limit), 730))
    offset = max(0, int(offset))
    qs = KeralaGoldRateDaily.objects.all().order_by("-rate_date")
    total = qs.count()
    rows = list(qs[offset : offset + limit])
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "retention_days": _RETENTION_DAYS,
        "rows": [
            {
                "date": r.rate_date.isoformat(),
                "gold_24k": str(r.inr_per_gram_24k),
                "gold_22k": str(r.inr_per_gram_22k),
                "gold_18k": str(r.inr_per_gram_18k),
                "silver_999": str(r.silver_999_inr) if r.silver_999_inr is not None else None,
                "source": r.source,
            }
            for r in rows
        ],
    }


def yesterday_change_for_metal(metal: str = "22K") -> dict[str, str | None]:
    mk = normalize_board_metal_param(metal)
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    today_row = AkgsmaBoardDailySnapshot.objects.filter(snapshot_date=today).first()
    prev_row = AkgsmaBoardDailySnapshot.objects.filter(snapshot_date=yesterday).first()
    if today_row is None or prev_row is None:
        return {"change_inr": None, "change_pct": None}
    cur = _daily_value_for_metal(today_row, mk)
    prev = _daily_value_for_metal(prev_row, mk)
    if cur is None or prev is None or prev <= 0:
        return {"change_inr": None, "change_pct": None}
    ch = (cur - prev).quantize(Decimal("0.01"))
    pct = ((ch / prev) * Decimal("100")).quantize(Decimal("0.0001"))
    return {"change_inr": str(ch), "change_pct": str(pct)}


def latest_board_rates_payload(*, source_prefix: str = "kerala_gold") -> dict | None:
    row = (
        AkgsmaBoardRateHistory.objects.filter(source__startswith=source_prefix)
        .order_by("-recorded_at")
        .first()
    )
    if row is None:
        row = AkgsmaBoardRateHistory.objects.order_by("-recorded_at").first()
    if row is None:
        snap = AkgsmaBoardDailySnapshot.objects.order_by("-snapshot_date").first()
        if snap is None:
            return None
        gold = {"22K": float(snap.close_inr_22k)}
        if snap.close_inr_18k is not None:
            gold["18K"] = float(snap.close_inr_18k)
        if snap.close_inr_24k is not None:
            gold["24K"] = float(snap.close_inr_24k)
        silver = {}
        if snap.silver_999_inr is not None:
            silver["999"] = float(snap.silver_999_inr)
        return {
            "currency": "INR",
            "unit": "per_gram",
            "source": "kerala_gold_rate_stale",
            "note": "Last stored Jos Alukkas gold rate — feed temporarily unavailable.",
            "rate_date": snap.board_date or snap.snapshot_date.isoformat(),
            "gold": gold,
            "silver": silver,
        }

    gold: dict[str, float] = {"22K": float(row.inr_per_gram_22k)}
    if row.inr_per_gram_18k is not None:
        gold["18K"] = float(row.inr_per_gram_18k)
    if row.inr_per_gram_24k is not None:
        gold["24K"] = float(row.inr_per_gram_24k)
    silver = {}
    if row.silver_999_inr is not None:
        silver["999"] = float(row.silver_999_inr)
    return {
        "currency": "INR",
        "unit": "per_gram",
        "source": "kerala_gold_rate_stale",
        "note": "Last stored Jos Alukkas gold rate — feed temporarily unavailable.",
        "rate_date": row.board_date or "",
        "gold": gold,
        "silver": silver,
    }


def kerala_board_history_latest_point(payload: dict | None) -> dict[str, Any]:
    now = timezone.now()
    out: dict[str, Any] = {
        "t": now.astimezone(py_tz.utc).isoformat().replace("+00:00", "Z"),
        "source": "kerala_gold_rate",
        "rate_date": None,
        "gold": {},
    }
    if not isinstance(payload, dict):
        return out
    gold = payload.get("gold") if isinstance(payload.get("gold"), dict) else {}
    silver = payload.get("silver") if isinstance(payload.get("silver"), dict) else {}
    out["source"] = str(payload.get("source") or "kerala_gold_rate")
    out["rate_date"] = payload.get("rate_date")
    out["gold"] = {str(k): str(v) for k, v in gold.items() if v is not None}
    if gold.get("22K") is not None:
        out["v"] = str(gold["22K"])
    if gold.get("18K") is not None:
        out["v18"] = str(gold["18K"])
    if gold.get("24K") is not None:
        out["v24"] = str(gold["24K"])
    if silver.get("999") is not None:
        out["silver"] = str(silver["999"])
    return out
