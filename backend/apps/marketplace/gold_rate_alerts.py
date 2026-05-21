"""Detect large moves in public Cridora 22K reference; broadcast to all push subscribers (public market alert)."""

from __future__ import annotations

from decimal import Decimal

from django.core.cache import cache
from django.db import transaction

from apps.accounts.push_payload import build_push_payload
from apps.accounts.webpush_service import push_delivery_configured, send_push_broadcast_localized

from .gold_push_copy import (
    format_gold_price_move_body,
    gold_rate_alert_title,
)
from .models import GoldTickerConfig, get_or_create_ticker
from .spot_prices import resolve_cridora_base_22k_inr

_ALERT_LOCK_KEY = "marketplace_gold_rate_alert_lock"
_ALERT_LOCK_TTL = 50


def maybe_notify_gold_rate_move(*, force: bool = False) -> dict:
    """
    If public Cridora 22K reference moved by ≥ threshold vs previous baseline, advance baseline and broadcast push.
    Uses a short cache lock unless force=True (e.g. cron or after admin ticker save).
    """
    result: dict = {"sent": False, "skipped": "unknown"}
    if not push_delivery_configured():
        result["skipped"] = "push_not_configured"
        return result
    if not force and not cache.add(_ALERT_LOCK_KEY, 1, timeout=_ALERT_LOCK_TTL):
        result["skipped"] = "lock_busy"
        return result

    current, _src = resolve_cridora_base_22k_inr()
    current = current.quantize(Decimal("0.01"))
    ticker_pk = get_or_create_ticker().pk

    title = "Gold rate alert"
    link = "/marketplace"
    image_url = ""
    body: str | None = None
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
        link = (t.rate_move_alert_link or "/marketplace").strip() or "/marketplace"
        image_url = (t.gold_push_image_url or "").strip()

        baseline = t.rate_alert_baseline_inr_per_gram_22k
        if baseline is None:
            GoldTickerConfig.objects.filter(pk=t.pk).update(
                rate_alert_baseline_inr_per_gram_22k=current
            )
            result["skipped"] = "baseline_init"
            result["baseline_inr"] = str(current)
            return result

        baseline = baseline.quantize(Decimal("0.01"))
        delta = (current - baseline).quantize(Decimal("0.01"))
        swing = abs(delta)
        if swing < threshold:
            result["skipped"] = "below_threshold"
            result["current_inr"] = str(current)
            result["delta_inr"] = str(delta)
            return result

        body = format_gold_price_move_body(baseline=baseline, current=current)
        GoldTickerConfig.objects.filter(pk=t.pk).update(
            rate_alert_baseline_inr_per_gram_22k=current
        )

    if body:
        payloads = {}
        for loc in ("en", "ml"):
            title_loc = (title if loc == "en" else gold_rate_alert_title(loc)).strip() or gold_rate_alert_title(loc)
            payloads[loc] = build_push_payload(
                title=title_loc,
                body=format_gold_price_move_body(baseline=baseline, current=current, locale=loc),
                url=link,
                tag="cridora-gold-rate",
                image_url=image_url or None,
            )
        n = send_push_broadcast_localized(payloads)
        result["sent"] = True
        result["subscriptions_notified"] = n
        result["delta_inr"] = str(delta)
        result["current_inr"] = str(current)

    return result
