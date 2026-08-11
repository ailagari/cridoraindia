"""Durable push outbox flushed after GoldPriceUpdated pipeline (and by scheduler)."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

# Backoff: 30s, 2m, 8m, 32m, then give up (max_attempts default 5).
_BACKOFF_SECONDS = (30, 120, 480, 1920)


def reset_push_queue() -> None:
    """No-op kept for call-site compatibility (durable rows are not discarded)."""
    return None


def enqueue_push_delivery(fn) -> None:
    """
    Legacy callable enqueue — run immediately with isolation.

    Prefer enqueue_user_push / enqueue_broadcast_localized so work survives crashes.
    """
    try:
        fn()
    except Exception:
        logger.exception("legacy enqueue_push_delivery callable failed")


def enqueue_user_push(user_id: int, payload: dict[str, Any], *, tag: str = "") -> None:
    from apps.accounts.models import PushOutbox

    resolved_tag = (tag or str(payload.get("tag") or ""))[:64]
    PushOutbox.objects.create(
        kind=PushOutbox.KIND_USER,
        user_id=user_id,
        payload=payload,
        tag=resolved_tag,
        status=PushOutbox.STATUS_PENDING,
        available_at=timezone.now(),
    )


def enqueue_broadcast_localized(
    payloads_by_locale: dict[str, dict[str, Any]],
    *,
    tag: str = "",
) -> None:
    from apps.accounts.models import PushOutbox

    if not payloads_by_locale:
        return
    sample = next(iter(payloads_by_locale.values()))
    resolved_tag = (tag or str(sample.get("tag") or ""))[:64]
    PushOutbox.objects.create(
        kind=PushOutbox.KIND_BROADCAST_LOCALIZED,
        user=None,
        payload=payloads_by_locale,
        tag=resolved_tag,
        status=PushOutbox.STATUS_PENDING,
        available_at=timezone.now(),
    )


def queue_len() -> int:
    from apps.accounts.models import PushOutbox

    return PushOutbox.objects.filter(
        status__in=(PushOutbox.STATUS_PENDING, PushOutbox.STATUS_PROCESSING)
    ).count()


def _claim_batch(limit: int) -> list:
    from django.db import connection

    from apps.accounts.models import PushOutbox

    now = timezone.now()
    lock_kwargs: dict[str, bool] = {}
    if getattr(connection.features, "has_select_for_update_skip_locked", False):
        lock_kwargs["skip_locked"] = True
    with transaction.atomic():
        qs = (
            PushOutbox.objects.select_for_update(**lock_kwargs)
            .filter(status=PushOutbox.STATUS_PENDING, available_at__lte=now)
            .order_by("available_at", "id")[:limit]
        )
        rows = list(qs)
        if not rows:
            return []
        PushOutbox.objects.filter(pk__in=[r.pk for r in rows]).update(
            status=PushOutbox.STATUS_PROCESSING,
            updated_at=now,
        )
        for row in rows:
            row.status = PushOutbox.STATUS_PROCESSING
        return rows


def _deliver_row(row) -> None:
    from apps.accounts.models import PushOutbox
    from apps.accounts.webpush_service import send_push_broadcast_localized, send_push_to_user

    if row.kind == PushOutbox.KIND_USER:
        if not row.user_id:
            raise ValueError("user outbox row missing user_id")
        send_push_to_user(row.user, row.payload or {})
        return
    if row.kind == PushOutbox.KIND_BROADCAST_LOCALIZED:
        payloads = row.payload or {}
        if not isinstance(payloads, dict) or not payloads:
            raise ValueError("broadcast outbox row missing payloads")
        send_push_broadcast_localized(payloads)
        return
    raise ValueError(f"unknown outbox kind={row.kind}")


def _mark_sent(row) -> None:
    from apps.accounts.models import PushOutbox

    now = timezone.now()
    PushOutbox.objects.filter(pk=row.pk).update(
        status=PushOutbox.STATUS_SENT,
        sent_at=now,
        last_error="",
        updated_at=now,
    )


def _mark_retry_or_fail(row, exc: BaseException) -> None:
    from apps.accounts.models import PushOutbox

    now = timezone.now()
    attempts = int(row.attempts or 0) + 1
    err = str(exc)[:255]
    if attempts >= int(row.max_attempts or 5):
        PushOutbox.objects.filter(pk=row.pk).update(
            status=PushOutbox.STATUS_FAILED,
            attempts=attempts,
            last_error=err,
            updated_at=now,
        )
        logger.error(
            "push outbox permanently failed id=%s kind=%s attempts=%s error=%s",
            row.pk,
            row.kind,
            attempts,
            err,
        )
        return
    delay = _BACKOFF_SECONDS[min(attempts - 1, len(_BACKOFF_SECONDS) - 1)]
    PushOutbox.objects.filter(pk=row.pk).update(
        status=PushOutbox.STATUS_PENDING,
        attempts=attempts,
        last_error=err,
        available_at=now + timedelta(seconds=delay),
        updated_at=now,
    )
    logger.warning(
        "push outbox retry scheduled id=%s kind=%s attempts=%s delay_s=%s error=%s",
        row.pk,
        row.kind,
        attempts,
        delay,
        err,
    )


def flush_push_queue(*, limit: int = 200) -> int:
    """Claim and deliver pending outbox rows. Safe to call concurrently (skip_locked)."""
    from apps.accounts.models import PushOutbox

    # Recover rows stuck in processing (worker died mid-flush).
    stale_before = timezone.now() - timedelta(minutes=10)
    PushOutbox.objects.filter(
        status=PushOutbox.STATUS_PROCESSING,
        updated_at__lt=stale_before,
    ).update(status=PushOutbox.STATUS_PENDING, updated_at=timezone.now())

    sent = 0
    while sent < limit:
        batch = _claim_batch(min(50, limit - sent))
        if not batch:
            break
        for row in batch:
            try:
                _deliver_row(row)
                _mark_sent(row)
                sent += 1
            except Exception as exc:
                _mark_retry_or_fail(row, exc)
    return sent


def process_pending_push_outbox(*, limit: int = 100) -> int:
    """Scheduler entrypoint for retries / backlog drain."""
    return flush_push_queue(limit=limit)
