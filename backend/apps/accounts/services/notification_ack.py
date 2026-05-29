"""Acknowledge notifications: remove from the user's feed (delete-on-read)."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from django.utils import timezone

from apps.accounts.models import (
    AdminNotification,
    AdminNotificationRead,
    NotificationEventLog,
    PortfolioUserNotification,
)
from apps.accounts.services.festival_broadcast import prune_festival_broadcast_feed_notifications
from apps.accounts.services.notification_analytics import log_notification_event

User = get_user_model()


def _active_admin_ids() -> list[int]:
    return list(
        User.objects.filter(user_type=User.ADMIN, is_active=True).values_list("pk", flat=True)
    )


def _maybe_delete_fully_read_admin_notification(notification_id: int) -> None:
    admin_ids = _active_admin_ids()
    if not admin_ids:
        return
    read_count = AdminNotificationRead.objects.filter(notification_id=notification_id).count()
    if read_count >= len(admin_ids):
        AdminNotification.objects.filter(pk=notification_id).delete()


def ack_portfolio_notifications(
    user: User,
    *,
    notification_ids: list[int] | None = None,
    mark_all: bool = False,
) -> int:
    base = PortfolioUserNotification.objects.filter(user=user)
    if mark_all:
        qs = base
    elif notification_ids:
        qs = base.filter(id__in=notification_ids[:200])
    else:
        return 0
    for row in qs.iterator(chunk_size=100):
        log_notification_event(
            user,
            event_type=NotificationEventLog.EVENT_CLICKED,
            category=row.category,
            kind=row.kind,
            title=row.title,
        )
    deleted, _ = qs.delete()
    return deleted


def ack_shared_admin_notifications(
    user: User,
    *,
    notification_ids: list[int] | None = None,
    mark_all: bool = False,
    festival_only: bool = False,
    exclude_festival: bool = False,
) -> int:
    """
    Dismiss shared AdminNotification rows for this user.
    Festival rows stay in DB for other users; compliance rows delete when all admins dismissed.
    """
    base = AdminNotification.objects.all()
    if festival_only:
        base = base.filter(kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT)
    elif exclude_festival:
        base = base.exclude(kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT)

    if mark_all:
        qs = base.order_by("-id")[:500]
    elif notification_ids:
        qs = base.filter(id__in=notification_ids[:200])
    else:
        return 0

    acked = 0
    for notif in qs.iterator(chunk_size=100):
        _, created = AdminNotificationRead.objects.get_or_create(user=user, notification=notif)
        if created:
            acked += 1
        if exclude_festival:
            _maybe_delete_fully_read_admin_notification(notif.pk)

    if festival_only:
        prune_festival_broadcast_feed_notifications()
    return acked


def festival_unread_queryset(user: User):
    read_ids = AdminNotificationRead.objects.filter(user=user).values_list(
        "notification_id", flat=True
    )
    return AdminNotification.objects.filter(
        kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT,
    ).exclude(pk__in=read_ids)


def admin_compliance_unread_queryset(user: User):
    read_ids = AdminNotificationRead.objects.filter(user=user).values_list(
        "notification_id", flat=True
    )
    return AdminNotification.objects.exclude(
        kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT,
    ).exclude(pk__in=read_ids)
