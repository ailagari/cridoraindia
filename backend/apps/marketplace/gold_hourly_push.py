"""Hourly Web Push digest: Cridora 22K ₹/g vs previous hourly snapshot."""

from __future__ import annotations

from decimal import Decimal

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.accounts.push_payload import build_push_payload
from apps.accounts.webpush_service import push_delivery_configured, send_push_broadcast

from .models import GoldTickerConfig, get_or_create_ticker
from .spot_prices import resolve_cridora_base_22k_inr

_LOCK_KEY = "marketplace_hourly_gold_push_lock"
_LOCK_TTL = 120


def _fmt_inr(d: Decimal) -> str:
    q = d.quantize(Decimal("0.01"))
    s = format(q, "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def run_hourly_gold_price_push_digest(*, force: bool = False) -> dict:
    """
    Compare current public 22K reference to the last hourly snapshot; broadcast when price moved.
    The first successful run only stores a baseline (no notification).

    Schedule: run management command `run_hourly_gold_push` every hour (e.g. Railway Cron).
    """
    result: dict = {"sent": False, "skipped": "unknown"}
    if not force and not cache.add(_LOCK_KEY, 1, timeout=_LOCK_TTL):
        result["skipped"] = "lock_busy"
        return result

    current, _src = resolve_cridora_base_22k_inr()
    current = current.quantize(Decimal("0.01"))
    ticker_pk = get_or_create_ticker().pk

    body: str | None = None
    title = "Gold price update"
    link = "/marketplace"
    image_url = ""
    with transaction.atomic():
        t = GoldTickerConfig.objects.select_for_update().get(pk=ticker_pk)
        if not t.hourly_gold_push_enabled:
            result["skipped"] = "disabled"
            return result

        title = (t.hourly_gold_push_title or "Gold price update").strip() or "Gold price update"
        link = (t.hourly_gold_push_link or "/marketplace").strip() or "/marketplace"
        image_url = (t.gold_push_image_url or "").strip()

        baseline = t.hourly_gold_push_baseline_inr_per_gram_22k
        if baseline is None:
            GoldTickerConfig.objects.filter(pk=t.pk).update(
                hourly_gold_push_baseline_inr_per_gram_22k=current,
                hourly_gold_push_baseline_recorded_at=timezone.now(),
            )
            result["skipped"] = "baseline_init"
            result["baseline_inr"] = str(current)
            return result

        baseline = baseline.quantize(Decimal("0.01"))
        delta = (current - baseline).quantize(Decimal("0.01"))
        if delta == 0:
            GoldTickerConfig.objects.filter(pk=t.pk).update(
                hourly_gold_push_baseline_recorded_at=timezone.now(),
            )
            result["skipped"] = "no_change"
            result["current_inr"] = str(current)
            return result

        swing = abs(delta)
        direction = "up" if delta > 0 else "down"
        body = (
            f"Public 22K reference is ₹{_fmt_inr(current)}/g ({direction} ₹{_fmt_inr(swing)}/g in the past hour "
            f"from ₹{_fmt_inr(baseline)}/g). Open your dashboard or marketplace for live rates."
        )

        GoldTickerConfig.objects.filter(pk=t.pk).update(
            hourly_gold_push_baseline_inr_per_gram_22k=current,
            hourly_gold_push_baseline_recorded_at=timezone.now(),
        )

    if body:
        if not push_delivery_configured():
            result["skipped"] = "push_not_configured"
            result["current_inr"] = str(current)
            result["delta_inr"] = str(delta)
            return result
        n = send_push_broadcast(
            build_push_payload(
                title=title,
                body=body,
                url=link,
                tag="cridora-gold-hourly",
                image_url=image_url or None,
            )
        )
        result["sent"] = True
        result["subscriptions_notified"] = n
        result["delta_inr"] = str(delta)
        result["current_inr"] = str(current)

    return result
