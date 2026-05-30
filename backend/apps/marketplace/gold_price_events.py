"""
Event-driven gold price ingestion and notification pipeline.

Live market alerts must not rely on Railway cron. Publish GoldPriceUpdated when the
platform or jeweller reference changes, then recalculate metrics and deliver pushes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction

from apps.accounts.services.notification_push_queue import flush_push_queue, reset_push_queue
from apps.marketplace.gold_ticker_history import persist_ticker_final_price

logger = logging.getLogger(__name__)
User = get_user_model()

Scope = Literal["platform", "jeweller"]
_CACHE_LAST_PLATFORM = "gold_price:last_ingested_platform_22k_v1"


@dataclass(frozen=True)
class GoldPriceUpdated:
    scope: Scope
    previous_rate: Decimal | None
    new_rate: Decimal
    source: str
    jeweller_id: int | None = None
    updated_by_id: int | None = None


def _read_last_platform_rate() -> Decimal | None:
    raw = cache.get(_CACHE_LAST_PLATFORM)
    if raw is None:
        return None
    try:
        return Decimal(str(raw)).quantize(Decimal("0.01"))
    except Exception:
        return None


def _write_last_platform_rate(rate: Decimal) -> None:
    cache.set(_CACHE_LAST_PLATFORM, str(rate.quantize(Decimal("0.01"))), 86400 * 30)


def ingest_platform_gold_price(
    *,
    base: Decimal,
    source: str,
    updated_by: User | None = None,
) -> dict:
    """
    Record ticker history sample; publish GoldPriceUpdated when 22K reference changed.
    """
    new_rate = base.quantize(Decimal("0.01"))
    previous_rate = _read_last_platform_rate()
    persist_ticker_final_price(base=new_rate, source=source)
    if previous_rate is not None and previous_rate == new_rate:
        return {"published": False, "reason": "unchanged", "new_rate": str(new_rate)}
    _write_last_platform_rate(new_rate)
    publish_gold_price_updated(
        GoldPriceUpdated(
            scope="platform",
            previous_rate=previous_rate,
            new_rate=new_rate,
            source=source,
            updated_by_id=updated_by.pk if updated_by else None,
        )
    )
    return {
        "published": True,
        "previous_rate": str(previous_rate) if previous_rate is not None else None,
        "new_rate": str(new_rate),
        "source": source,
    }


def publish_gold_price_updated(event: GoldPriceUpdated) -> None:
    """Schedule notification pipeline after the current DB transaction commits."""
    if transaction.get_connection().in_atomic_block:
        transaction.on_commit(lambda: _dispatch_gold_price_updated(event))
    else:
        _dispatch_gold_price_updated(event)


def publish_jeweller_gold_price_updated(
    *,
    jeweller_id: int,
    previous_rate: Decimal,
    new_rate: Decimal,
    updated_by: User | None = None,
) -> None:
    publish_gold_price_updated(
        GoldPriceUpdated(
            scope="jeweller",
            previous_rate=previous_rate.quantize(Decimal("0.01")),
            new_rate=new_rate.quantize(Decimal("0.01")),
            source="jeweller_manual",
            jeweller_id=jeweller_id,
            updated_by_id=updated_by.pk if updated_by else None,
        )
    )


def _dispatch_gold_price_updated(event: GoldPriceUpdated) -> None:
    reset_push_queue()
    try:
        from apps.marketplace.gold_price_notification_pipeline import handle_gold_price_updated

        handle_gold_price_updated(event)
        flush_push_queue()
    except Exception:
        logger.exception("GoldPriceUpdated pipeline failed scope=%s", event.scope)
        reset_push_queue()
