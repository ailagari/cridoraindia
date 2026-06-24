"""Platform 22K threshold broadcast (event-driven; not cron)."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from apps.accounts.push_tap_links import build_tap_push_payload
from apps.accounts.services.notification_push_queue import enqueue_push_delivery
from apps.accounts.webpush_service import push_delivery_configured, send_push_broadcast_localized

from .gold_push_copy import format_gold_price_move_body, gold_rate_alert_title
from .gold_push_tap_links import rate_move_tap_paths
from .models import GoldTickerConfig, get_or_create_ticker


def evaluate_platform_threshold_broadcast(
    *,
    previous_rate: Decimal,
    new_rate: Decimal,
    defer_push: bool = False,
) -> dict:
    """
    If move ≥ threshold vs stored alert baseline, advance baseline and broadcast push.
    Uses explicit previous/new from GoldPriceUpdated (not a cron poll).
    """
    result: dict = {"sent": False, "skipped": "unknown"}
    if not push_delivery_configured():
        result["skipped"] = "push_not_configured"
        return result

    current = new_rate.quantize(Decimal("0.01"))
    ticker_pk = get_or_create_ticker().pk

    title = "Gold rate alert"
    guest = "/marketplace"
    auth = "/marketplace"
    fb = "/marketplace"
    image_url = ""
    baseline = previous_rate.quantize(Decimal("0.01"))

    with transaction.atomic():
        t = GoldTickerConfig.objects.select_for_update().get(pk=ticker_pk)
        if not t.rate_move_alerts_enabled:
            result["skipped"] = "disabled"
            return result

        threshold = (t.rate_move_alert_threshold_inr or Decimal("0")).quantize(Decimal("0.01"))
        if threshold <= 0:
            result["skipped"] = "threshold_zero"
            return result

        title = (t.rate_move_alert_title or "Gold rate alert").strip() or "Gold rate alert"
        guest, auth, fb = rate_move_tap_paths(t)
        image_url = (t.gold_push_image_url or "").strip()

        stored_baseline = t.rate_alert_baseline_inr_per_gram_22k
        if stored_baseline is not None:
            baseline = stored_baseline.quantize(Decimal("0.01"))

        delta = (current - baseline).quantize(Decimal("0.01"))
        swing = abs(delta)
        if swing < threshold:
            result["skipped"] = "below_threshold"
            result["current_inr"] = str(current)
            result["delta_inr"] = str(delta)
            return result

        GoldTickerConfig.objects.filter(pk=t.pk).update(
            rate_alert_baseline_inr_per_gram_22k=current
        )

    rate_up = delta > 0
    payloads = {}
    for loc in ("en", "ml"):
        title_loc = gold_rate_alert_title(loc, rate_increased=rate_up).strip()
        if loc == "en" and title and title not in ("Gold rate alert", ""):
            title_loc = title
        payloads[loc] = build_tap_push_payload(
            title=title_loc or gold_rate_alert_title(loc, rate_increased=rate_up),
            body=format_gold_price_move_body(baseline=baseline, current=current, locale=loc),
            fallback_url=fb,
            url_guest=guest,
            url_authenticated=auth,
            tag="cridora-gold-rate",
            image_url=image_url or None,
        )

    def _broadcast() -> None:
        send_push_broadcast_localized(payloads)

    if defer_push:
        enqueue_push_delivery(_broadcast)
    else:
        _broadcast()

    result["sent"] = True
    result["delta_inr"] = str(delta)
    result["current_inr"] = str(current)
    result["baseline_inr"] = str(baseline)
    return result


def maybe_notify_gold_rate_move(*, force: bool = False) -> dict:
    """Deprecated: use ingest_platform_gold_price + GoldPriceUpdated pipeline."""
    from .spot_prices import resolve_cridora_base_22k_inr

    current, _src = resolve_cridora_base_22k_inr()
    current = current.quantize(Decimal("0.01"))
    ticker = get_or_create_ticker()
    baseline = ticker.rate_alert_baseline_inr_per_gram_22k
    if baseline is None:
        GoldTickerConfig.objects.filter(pk=ticker.pk).update(
            rate_alert_baseline_inr_per_gram_22k=current
        )
        return {"sent": False, "skipped": "baseline_init", "deprecated": True}
    return evaluate_platform_threshold_broadcast(
        previous_rate=baseline.quantize(Decimal("0.01")),
        new_rate=current,
        defer_push=False,
    )
