"""Persist and query sampled Cridora 22K reference ₹/g for customer charts."""

from __future__ import annotations

import math
import time
from datetime import timedelta, timezone as py_tz
from decimal import Decimal
from typing import Any

from django.core.cache import cache
from django.utils import timezone

from .models import GoldTickerReferenceHistory

_DEBOUNCE_CACHE_KEY = "gold_ref_hist:debounce_v1"

RANGE_WINDOWS: dict[str, timedelta] = {
    "live": timedelta(hours=6),
    "1d": timedelta(days=1),
    "1w": timedelta(days=7),
    "1m": timedelta(days=30),
    "6m": timedelta(days=180),
    "1y": timedelta(days=365),
}

_ALIAS: dict[str, str] = {
    "day": "1d",
    "d": "1d",
    "24h": "1d",
    "week": "1w",
    "w": "1w",
    "month": "1m",
    "m": "1m",
    "6month": "6m",
    "6mth": "6m",
    "year": "1y",
    "y": "1y",
    "max": "1y",
    "maximum": "1y",
}


def normalize_range_param(raw: str) -> str:
    key = (raw or "1w").strip().lower()
    key = _ALIAS.get(key, key)
    return key if key in RANGE_WINDOWS else "1w"


def maybe_record_gold_reference_history(*, base: Decimal, source: str) -> None:
    """
    Append a row when the reference moves meaningfully or enough time passed.
    Debounced in-process via cache to limit DB reads under high spot-prices traffic.
    """
    now_ts = time.time()
    base_q = base.quantize(Decimal("0.01"))
    base_f = float(base_q)

    deb = cache.get(_DEBOUNCE_CACHE_KEY)
    if deb:
        last_ts, last_v = deb
        if now_ts - last_ts < 45 and abs(last_v - base_f) < 0.12:
            return

    last_row = (
        GoldTickerReferenceHistory.objects.order_by("-recorded_at")
        .only("recorded_at", "inr_per_gram_22k")
        .first()
    )
    if last_row is not None:
        age = (timezone.now() - last_row.recorded_at).total_seconds()
        if age < 300 and abs(float(last_row.inr_per_gram_22k) - base_f) < 0.20:
            cache.set(_DEBOUNCE_CACHE_KEY, (now_ts, base_f), 3600)
            return

    GoldTickerReferenceHistory.objects.create(
        inr_per_gram_22k=base_q,
        base_source=(source or "")[:64],
    )
    cache.set(_DEBOUNCE_CACHE_KEY, (now_ts, base_f), 3600)
    try:
        from .gold_rate_daily_snapshot import upsert_daily_from_sample

        upsert_daily_from_sample(price=base_q, source=source)
    except Exception:
        pass


def fetch_history_payload(*, range_key: str, max_points: int = 900) -> dict[str, Any]:
    rk = normalize_range_param(range_key)
    if rk in {"1w", "1m", "6m", "1y"}:
        from .gold_rate_daily_snapshot import fetch_daily_history_payload

        return fetch_daily_history_payload(range_key=rk)

    window = RANGE_WINDOWS[rk]
    start = timezone.now() - window

    qs = GoldTickerReferenceHistory.objects.filter(recorded_at__gte=start).order_by("recorded_at")
    rows = list(qs.values("recorded_at", "inr_per_gram_22k", "base_source"))
    if len(rows) > max_points:
        step = int(math.ceil(len(rows) / max_points))
        rows = rows[::step]

    points: list[dict[str, str]] = []
    for r in rows:
        ts = r["recorded_at"]
        if timezone.is_naive(ts):
            ts = timezone.make_aware(ts, timezone.get_current_timezone())
        points.append(
            {
                "t": ts.astimezone(py_tz.utc).isoformat().replace("+00:00", "Z"),
                "v": str(r["inr_per_gram_22k"]),
                "src": str(r["base_source"] or ""),
            }
        )

    return {
        "range": rk,
        "granularity": "intraday",
        "window_hours": round(window.total_seconds() / 3600, 4),
        "note": "Cridora platform 22K ₹/g reference (after live or manual ticker settings). "
        "Points are recorded when the reference changes or periodically — not tick-level market data.",
        "points": points,
    }
