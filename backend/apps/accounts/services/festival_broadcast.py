"""Process scheduled festival / broadcast Web Push notifications."""

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import AdminNotification, FestivalBroadcastNotification
from apps.accounts.webpush_service import send_push_broadcast


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
                device_note = (
                    f"Sent to {n} subscribed device(s)."
                    if n
                    else "Sent to 0 devices — check VAPID env vars and user subscriptions."
                )
                body_feed = f"{preview}\n\n{device_note}" if preview else device_note
                AdminNotification.objects.create(
                    kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT,
                    title=row.title.strip() or "Festival broadcast sent",
                    body=body_feed,
                    link_path="/dashboard/admin?section=plat_festival",
                    actor=row.created_by,
                )
            except Exception as exc:
                row.status = FestivalBroadcastNotification.STATUS_FAILED
                row.error_message = str(exc)[:2000]
                row.save(update_fields=["status", "error_message"])
        finalized += 1
    return finalized
