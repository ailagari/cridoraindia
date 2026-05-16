"""Process scheduled festival / broadcast Web Push notifications."""

import logging
import re

from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from apps.accounts.models import AdminNotification, FestivalBroadcastNotification, WebPushSubscription
from apps.accounts.webpush_service import send_push_broadcast

logger = logging.getLogger(__name__)

MAX_RETAINED_FESTIVAL_SCHEDULES = 3
MAX_RETAINED_FESTIVAL_FEED_ROWS = 3

_ZERO_DEVICE_SUFFIX = "Sent to 0 devices — check VAPID env vars and user subscriptions."
_SENT_COUNT_SUFFIX_RE = re.compile(r"(?:\r?\n){2}Sent to \d+ subscribed device\(s\)\.\s*\Z")


def strip_festival_broadcast_feed_body(text: str) -> str:
    """Remove internal delivery stats appended to older in-app festival receipts."""
    if not text:
        return ""
    s = text.rstrip()
    if s.endswith(_ZERO_DEVICE_SUFFIX):
        s = s[: -len(_ZERO_DEVICE_SUFFIX)].rstrip()
    s = _SENT_COUNT_SUFFIX_RE.sub("", s)
    return s.rstrip()


def prune_festival_broadcast_feed_notifications(*, max_rows: int = MAX_RETAINED_FESTIVAL_FEED_ROWS) -> int:
    """Keep only the newest ``max_rows`` in-app festival receipts; return deleted row count."""
    base = AdminNotification.objects.filter(kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT).order_by(
        "-created_at", "-id"
    )
    keep_ids = list(base.values_list("pk", flat=True)[:max_rows])
    remove = AdminNotification.objects.filter(kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT)
    if keep_ids:
        remove = remove.exclude(pk__in=keep_ids)
    deleted, _ = remove.delete()
    return deleted


def prune_festival_completed_schedules(*, max_rows: int = MAX_RETAINED_FESTIVAL_SCHEDULES) -> int:
    """
    Keep only the newest ``max_rows`` completed festival schedule rows (sent / failed / cancelled).
    Pending schedules are never deleted.
    """
    terminal = (
        FestivalBroadcastNotification.STATUS_SENT,
        FestivalBroadcastNotification.STATUS_FAILED,
        FestivalBroadcastNotification.STATUS_CANCELLED,
    )
    completed = FestivalBroadcastNotification.objects.filter(status__in=terminal).order_by(
        "-created_at", "-id"
    )
    keep_ids = list(completed.values_list("pk", flat=True)[:max_rows])
    remove = FestivalBroadcastNotification.objects.filter(status__in=terminal)
    if keep_ids:
        remove = remove.exclude(pk__in=keep_ids)
    deleted, _ = remove.delete()
    return deleted


def prune_festival_broadcast_history() -> tuple[int, int]:
    """Trim stored festival schedule history and in-app feed rows to policy limits."""
    n_sched = prune_festival_completed_schedules()
    n_feed = prune_festival_broadcast_feed_notifications()
    if n_sched or n_feed:
        logger.info(
            "festival_broadcast retention pruned schedules=%s feed_notifications=%s",
            n_sched,
            n_feed,
        )
    return n_sched, n_feed


def process_due_festival_broadcasts(*, limit: int = 50) -> int:
    """
    Deliver all pending rows whose scheduled_at is in the past or now.

    Uses row-level locking to avoid duplicate sends when multiple workers run.
    Returns how many rows were finalized (sent, failed, or skipped after lock contention).
    """
    now = timezone.now()
    finalized = 0
    for _ in range(limit):
        with transaction.atomic():
            row = (
                FestivalBroadcastNotification.objects.select_for_update(skip_locked=True)
                .filter(
                    status=FestivalBroadcastNotification.STATUS_PENDING,
                    scheduled_at__lte=now,
                )
                .order_by("scheduled_at", "id")
                .first()
            )
            if row is None:
                break
            try:
                try:
                    sub_total = WebPushSubscription.objects.count()
                    by_role = {
                        r["user__user_type"]: r["c"]
                        for r in WebPushSubscription.objects.values("user__user_type").annotate(
                            c=Count("id")
                        )
                    }
                    logger.info(
                        "festival_broadcast id=%s sending web_push to all subscriptions total=%s by_user_type=%s",
                        row.pk,
                        sub_total,
                        by_role,
                    )
                except Exception:
                    logger.exception(
                        "festival_broadcast id=%s subscription stats log failed; continuing send",
                        row.pk,
                    )
                n = send_push_broadcast(
                    {
                        "title": row.title.strip() or "Cridora",
                        "body": row.body.strip(),
                        "url": "/",
                        "tag": f"cridora-festival-{row.pk}",
                    }
                )
                row.status = FestivalBroadcastNotification.STATUS_SENT
                row.sent_at = now
                row.push_recipient_count = n
                row.save(
                    update_fields=[
                        "status",
                        "sent_at",
                        "push_recipient_count",
                    ]
                )
                preview = row.body.strip()
                if len(preview) > 400:
                    preview = preview[:397] + "…"
                AdminNotification.objects.create(
                    kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT,
                    title=row.title.strip() or "Festival broadcast sent",
                    body=preview,
                    link_path="/",
                    actor=row.created_by,
                )
            except Exception as exc:
                row.status = FestivalBroadcastNotification.STATUS_FAILED
                row.error_message = str(exc)[:2000]
                row.save(update_fields=["status", "error_message"])
        finalized += 1
    prune_festival_broadcast_history()
    return finalized
