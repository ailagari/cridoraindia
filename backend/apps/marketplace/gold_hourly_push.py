"""Hourly Web Push digest: Cridora 22K ₹/g vs previous hourly snapshot."""

from __future__ import annotations

from decimal import Decimal

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.accounts.push_tap_links import build_tap_push_payload
from apps.accounts.services.notification_locale import localized_broadcast_payloads
from apps.accounts.webpush_service import push_delivery_configured, send_push_broadcast_localized

from .gold_push_copy import (
    format_gold_price_move_body,
    gold_hourly_push_title,
)
from .gold_push_tap_links import hourly_gold_tap_paths
from .models import GoldTickerConfig, get_or_create_ticker
from .spot_prices import resolve_cridora_base_22k_inr

_LOCK_KEY = "marketplace_hourly_gold_push_lock"
_LOCK_TTL = 120


def run_hourly_gold_price_push_digest(*, force: bool = False) -> dict:
    """
    Compare current public 22K reference to the last hourly snapshot; broadcast when price moved (all subscribers).
    The first successful run only stores a baseline (no notification).

    Deprecated for live alerts: hourly digest runs on GoldPriceUpdated ingest via
    evaluate_hourly_digest_on_price_ingest. Cron command retained for manual replay only.
    """
    result: dict = {"sent": False, "skipped": "unknown"}
    if not force and not cache.add(_LOCK_KEY, 1, timeout=_LOCK_TTL):
        result["skipped"] = "lock_busy"
        return result

    current, _src = resolve_cridora_base_22k_inr()
    current = current.quantize(Decimal("0.01"))
    ticker_pk = get_or_create_ticker().pk

    body: str | None = None
    guest = "/marketplace"
    auth = "/marketplace"
    fb = "/marketplace"
    image_url = ""
    delta = Decimal("0")
    baseline = current
    with transaction.atomic():
        t = GoldTickerConfig.objects.select_for_update().get(pk=ticker_pk)
        if not t.hourly_gold_push_enabled:
            result["skipped"] = "disabled"
            return result

        guest, auth, fb = hourly_gold_tap_paths(t)
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

        body = format_gold_price_move_body(baseline=baseline, current=current)

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
        n = send_push_broadcast_localized(
            localized_broadcast_payloads(
                en=build_tap_push_payload(
                    title=gold_hourly_push_title("en", rate_increased=delta > 0),
                    body=format_gold_price_move_body(baseline=baseline, current=current, locale="en"),
                    fallback_url=fb,
                    url_guest=guest,
                    url_authenticated=auth,
                    tag="cridora-gold-hourly",
                    image_url=image_url or None,
                ),
                ml=build_tap_push_payload(
                    title=gold_hourly_push_title("ml", rate_increased=delta > 0),
                    body=format_gold_price_move_body(baseline=baseline, current=current, locale="ml"),
                    fallback_url=fb,
                    url_guest=guest,
                    url_authenticated=auth,
                    tag="cridora-gold-hourly",
                    image_url=image_url or None,
                ),
            )
        )
        result["sent"] = True
        result["subscriptions_notified"] = n
        result["delta_inr"] = str(delta)
        result["current_inr"] = str(current)

    return result


_HOURLY_WINDOW_SECONDS = 3600


def evaluate_hourly_digest_on_price_ingest(
    *,
    new_rate: Decimal,
    defer_push: bool = False,
) -> dict:
    """
    On platform price ingest: send hourly digest when enabled, ≥1h since last snapshot, and price moved.
    """
    result: dict = {"sent": False, "skipped": "unknown"}
    if not push_delivery_configured():
        result["skipped"] = "push_not_configured"
        return result

    current = new_rate.quantize(Decimal("0.01"))
    ticker_pk = get_or_create_ticker().pk
    now = timezone.now()

    with transaction.atomic():
        t = GoldTickerConfig.objects.select_for_update().get(pk=ticker_pk)
        if not t.hourly_gold_push_enabled:
            result["skipped"] = "disabled"
            return result

        guest, auth, fb = hourly_gold_tap_paths(t)
        image_url = (t.gold_push_image_url or "").strip()

        baseline = t.hourly_gold_push_baseline_inr_per_gram_22k
        recorded_at = t.hourly_gold_push_baseline_recorded_at
        if baseline is None or recorded_at is None:
            GoldTickerConfig.objects.filter(pk=t.pk).update(
                hourly_gold_push_baseline_inr_per_gram_22k=current,
                hourly_gold_push_baseline_recorded_at=now,
            )
            result["skipped"] = "baseline_init"
            return result

        elapsed = (now - recorded_at).total_seconds()
        if elapsed < _HOURLY_WINDOW_SECONDS:
            result["skipped"] = "hour_not_elapsed"
            return result

        baseline = baseline.quantize(Decimal("0.01"))
        delta = (current - baseline).quantize(Decimal("0.01"))
        if delta == 0:
            GoldTickerConfig.objects.filter(pk=t.pk).update(
                hourly_gold_push_baseline_recorded_at=now,
            )
            result["skipped"] = "no_change"
            return result

        GoldTickerConfig.objects.filter(pk=t.pk).update(
            hourly_gold_push_baseline_inr_per_gram_22k=current,
            hourly_gold_push_baseline_recorded_at=now,
        )

    payloads = localized_broadcast_payloads(
        en=build_tap_push_payload(
            title=gold_hourly_push_title("en", rate_increased=delta > 0),
            body=format_gold_price_move_body(baseline=baseline, current=current, locale="en"),
            fallback_url=fb,
            url_guest=guest,
            url_authenticated=auth,
            tag="cridora-gold-hourly",
            image_url=image_url or None,
        ),
        ml=build_tap_push_payload(
            title=gold_hourly_push_title("ml", rate_increased=delta > 0),
            body=format_gold_price_move_body(baseline=baseline, current=current, locale="ml"),
            fallback_url=fb,
            url_guest=guest,
            url_authenticated=auth,
            tag="cridora-gold-hourly",
            image_url=image_url or None,
        ),
    )

    from apps.accounts.services.notification_push_queue import enqueue_broadcast_localized

    if defer_push:
        enqueue_broadcast_localized(payloads, tag="cridora-gold-hourly")
    else:
        send_push_broadcast_localized(payloads)

    result["sent"] = True
    result["delta_inr"] = str(delta)
    result["current_inr"] = str(current)
    return result
