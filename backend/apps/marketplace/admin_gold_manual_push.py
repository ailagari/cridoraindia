"""Admin-initiated gold price broadcast without mutating alert baselines."""

from __future__ import annotations

from decimal import Decimal

from apps.accounts.push_tap_links import build_tap_push_payload
from apps.accounts.webpush_service import push_delivery_configured, send_push_broadcast_localized
from apps.marketplace.gold_push_copy import format_gold_price_move_body, gold_rate_alert_title
from apps.marketplace.gold_push_tap_links import rate_move_tap_paths
from apps.marketplace.models import get_or_create_ticker
from apps.marketplace.platform_gold_notify import notify_customers_platform_gold_move
from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr


def send_manual_gold_price_notification(
    *,
    title: str | None = None,
    body: str | None = None,
    image_url: str | None = None,
    link_path: str | None = None,
    use_live_price_line: bool = False,
) -> dict:
    """
    Broadcast + customer inbox using current 22K reference.
    Does not update rate_alert_baseline or hourly baselines.
    """
    if not push_delivery_configured():
        return {"ok": False, "detail": "Push is not configured.", "sent_broadcast": 0, "sent_inbox": 0}

    current, _src = resolve_cridora_base_22k_inr()
    current = current.quantize(Decimal("0.01"))
    ticker = get_or_create_ticker()

    guest, auth, fb = rate_move_tap_paths(ticker)
    img = (image_url or ticker.gold_push_image_url or "").strip()
    title_en = (title or ticker.rate_move_alert_title or "Gold price update").strip() or "Gold price update"

    if use_live_price_line or not (body or "").strip():
        baseline = current
        body_en = format_gold_price_move_body(baseline=baseline, current=current)
    else:
        body_en = (body or "").strip()

    if link_path:
        fb = (link_path or fb).strip() or fb
        guest, auth = fb, fb

    payloads = {
        "en": build_tap_push_payload(
            title=title_en,
            body=body_en,
            fallback_url=fb,
            url_guest=guest,
            url_authenticated=auth,
            tag="cridora-gold-manual",
            image_url=img or None,
        ),
        "ml": build_tap_push_payload(
            title=gold_rate_alert_title("ml"),
            body=format_gold_price_move_body(baseline=current, current=current, locale="ml")
            if use_live_price_line
            else body_en,
            fallback_url=fb,
            url_guest=guest,
            url_authenticated=auth,
            tag="cridora-gold-manual",
            image_url=img or None,
        ),
    }
    n_broadcast = send_push_broadcast_localized(payloads)
    n_inbox = notify_customers_platform_gold_move(
        baseline=current,
        current=current,
        title=title_en,
        link=auth,
        image_url=img,
        body=body_en,
    )
    return {
        "ok": True,
        "current_inr": str(current),
        "body_preview": body_en,
        "sent_broadcast": n_broadcast,
        "sent_inbox": n_inbox,
    }
