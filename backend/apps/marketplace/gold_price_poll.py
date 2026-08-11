"""
Periodic platform 22K poll so threshold / hourly / portfolio alerts fire without
admin "Send" and without relying on a visitor hitting the public ticker API.
"""

from __future__ import annotations

import logging
from decimal import Decimal

from django.core.cache import cache

logger = logging.getLogger(__name__)

_POLL_LOCK_KEY = "gold_price:inline_poll_lock_v1"
# Kerala boards move slowly; 2 minutes balances freshness vs upstream load.
_POLL_MIN_INTERVAL_SECONDS = 120


def maybe_poll_platform_gold_for_alerts(*, force: bool = False) -> dict:
    """
    Refresh live board rates and ingest the platform 22K reference.

    When the rate changes enough vs the alert baseline, the existing
    GoldPriceUpdated pipeline broadcasts tray pushes automatically.
    """
    if not force and not cache.add(_POLL_LOCK_KEY, "1", timeout=_POLL_MIN_INTERVAL_SECONDS):
        return {"polled": False, "reason": "throttled"}

    try:
        from apps.marketplace.gold_price_events import ingest_platform_gold_price
        from apps.marketplace.spot_prices import refresh_live_kerala_feed, resolve_cridora_base_22k_inr

        refresh_live_kerala_feed(force_fetch=True)
        base, src = resolve_cridora_base_22k_inr()
        out = ingest_platform_gold_price(
            base=base.quantize(Decimal("0.01")),
            source=f"poll:{src}",
        )
        out["polled"] = True
        return out
    except Exception:
        logger.exception("platform gold price poll failed")
        # Allow a quicker retry after failures.
        cache.delete(_POLL_LOCK_KEY)
        return {"polled": False, "reason": "error"}
