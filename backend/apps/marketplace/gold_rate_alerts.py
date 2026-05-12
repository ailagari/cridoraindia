"""Detect large moves in resolved 22K ₹/g and broadcast Web Push."""

from __future__ import annotations

from decimal import Decimal

from django.core.cache import cache
from django.db import transaction

from apps.accounts.webpush_service import send_push_broadcast, webpush_configured

from .models import GoldTickerConfig, get_or_create_ticker
from .spot_prices import resolve_cridora_base_22k_inr

_ALERT_LOCK_KEY = "marketplace_gold_rate_alert_lock"
_ALERT_LOCK_TTL = 50


def _fmt_rupees(d: Decimal) -> str:
    q = d.quantize(Decimal("0.01"))
    s = format(q, "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def maybe_notify_gold_rate_move(*, force: bool = False) -> None:
    """
    If resolved 22K has moved by ≥ configured threshold vs baseline, advance baseline and broadcast push.
    Uses a short cache lock unless force=True (e.g. after admin ticker save).
    """
    if not webpush_configured():
        return
    if not force and not cache.add(_ALERT_LOCK_KEY, 1, timeout=_ALERT_LOCK_TTL):
        return

    current, _src = resolve_cridora_base_22k_inr()
    current = current.quantize(Decimal("0.01"))
    ticker_pk = get_or_create_ticker().pk

    title = "Gold rate alert"
    body: str | None = None
    with transaction.atomic():
        t = GoldTickerConfig.objects.select_for_update().get(pk=ticker_pk)
        threshold = (t.rate_move_alert_threshold_inr or Decimal("0")).quantize(
            Decimal("0.01")
        )
        if threshold <= 0:
            return

        baseline = t.rate_alert_baseline_inr_per_gram_22k
        if baseline is None:
            GoldTickerConfig.objects.filter(pk=t.pk).update(
                rate_alert_baseline_inr_per_gram_22k=current
            )
            return

        baseline = baseline.quantize(Decimal("0.01"))
        delta = (current - baseline).quantize(Decimal("0.01"))
        swing = abs(delta)
        if swing < threshold:
            return

        direction = "up" if delta > 0 else "down"
        body = (
            f"Cridora 22K is now ₹{_fmt_rupees(current)}/g ({direction} ₹{_fmt_rupees(swing)} since last alert)."
        )
        GoldTickerConfig.objects.filter(pk=t.pk).update(
            rate_alert_baseline_inr_per_gram_22k=current
        )

    if body:
        send_push_broadcast(
            {
                "title": title,
                "body": body,
                "url": "/marketplace",
                "tag": "cridora-gold-rate",
            }
        )
