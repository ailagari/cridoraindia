"""Admin notification delivery funnel analytics."""

from __future__ import annotations

from django.db.models import Count

from apps.accounts.models import (
    NativePushToken,
    NotificationEventLog,
    NotificationPreference,
    PortfolioUserNotification,
    PushDeliveryAttempt,
    User,
    WebPushSubscription,
)


def _user_type_bucket(user_type: str) -> str:
    if user_type == User.JEWELLER:
        return "jewellers"
    if user_type == User.ADMIN:
        return "admins"
    return "customers"


def _eligible_users_by_type() -> dict[str, int]:
    push_user_ids = set(
        WebPushSubscription.objects.filter(user_id__isnull=False).values_list("user_id", flat=True)
    ) | set(NativePushToken.objects.filter(user_id__isnull=False).values_list("user_id", flat=True))
    pref_user_ids = set(
        NotificationPreference.objects.filter(allow_push_notifications=True).values_list(
            "user_id", flat=True
        )
    )
    eligible_ids = push_user_ids | pref_user_ids
    rows = (
        User.objects.filter(pk__in=eligible_ids, is_active=True)
        .values("user_type")
        .annotate(c=Count("id"))
    )
    out = {"customers": 0, "jewellers": 0, "admins": 0}
    for row in rows:
        out[_user_type_bucket(row["user_type"])] += row["c"]
    return out


def _inbox_delivered_by_type() -> dict[str, int]:
    rows = (
        PortfolioUserNotification.objects.filter(user_id__isnull=False)
        .values("user__user_type")
        .annotate(c=Count("id"))
    )
    out = {"customers": 0, "jewellers": 0, "admins": 0}
    for row in rows:
        out[_user_type_bucket(row["user__user_type"])] += row["c"]
    return out


def _push_attempts_by_type(statuses: tuple[str, ...]) -> dict[str, int]:
    rows = (
        PushDeliveryAttempt.objects.filter(status__in=statuses, user_id__isnull=False)
        .values("user__user_type")
        .annotate(c=Count("id"))
    )
    out = {"customers": 0, "jewellers": 0, "admins": 0}
    for row in rows:
        out[_user_type_bucket(row["user__user_type"])] += row["c"]
    return out


def _read_events_by_type() -> dict[str, int]:
    rows = (
        NotificationEventLog.objects.filter(
            user_id__isnull=False,
            event_type__in=(
                NotificationEventLog.EVENT_CLICKED,
                NotificationEventLog.EVENT_READ,
                NotificationEventLog.EVENT_TRAY_CLICKED,
            ),
        )
        .values("user__user_type")
        .annotate(c=Count("id"))
    )
    out = {"customers": 0, "jewellers": 0, "admins": 0}
    for row in rows:
        out[_user_type_bucket(row["user__user_type"])] += row["c"]
    return out


def admin_notification_stats_payload() -> dict:
    delivered = NotificationEventLog.objects.filter(
        event_type=NotificationEventLog.EVENT_DELIVERED
    ).count()
    clicked = NotificationEventLog.objects.filter(
        event_type__in=(
            NotificationEventLog.EVENT_CLICKED,
            NotificationEventLog.EVENT_READ,
            NotificationEventLog.EVENT_TRAY_CLICKED,
        )
    ).count()
    by_category = (
        NotificationEventLog.objects.filter(
            event_type=NotificationEventLog.EVENT_DELIVERED
        )
        .values("category")
        .annotate(c=Count("id"))
        .order_by("-c")[:20]
    )
    open_rate = round((clicked / delivered * 100), 2) if delivered else 0

    push_sent = PushDeliveryAttempt.objects.filter(
        status=PushDeliveryAttempt.STATUS_SENT
    ).count()
    push_failed = PushDeliveryAttempt.objects.filter(
        status=PushDeliveryAttempt.STATUS_FAILED
    ).count()
    tray_delivered = PushDeliveryAttempt.objects.filter(
        status=PushDeliveryAttempt.STATUS_TRAY_DELIVERED
    ).count()
    tray_clicked = PushDeliveryAttempt.objects.filter(
        status=PushDeliveryAttempt.STATUS_TRAY_CLICKED
    ).count()

    eligible = _eligible_users_by_type()
    inbox_by_type = _inbox_delivered_by_type()
    push_sent_by_type = _push_attempts_by_type((PushDeliveryAttempt.STATUS_SENT,))
    push_failed_by_type = _push_attempts_by_type((PushDeliveryAttempt.STATUS_FAILED,))
    read_by_type = _read_events_by_type()

    user_types = ("customers", "jewellers", "admins")
    by_user_type = []
    for key in user_types:
        by_user_type.append(
            {
                "user_type": key,
                "eligible": eligible[key],
                "inbox_delivered": inbox_by_type[key],
                "push_sent": push_sent_by_type[key],
                "push_failed": push_failed_by_type[key],
                "read": read_by_type[key],
            }
        )

    subs = {
        "web_push": WebPushSubscription.objects.filter(user_id__isnull=False).count(),
        "web_push_anonymous": WebPushSubscription.objects.filter(user_id__isnull=True).count(),
        "native_fcm": NativePushToken.objects.count(),
    }
    subs["total_push_devices"] = (
        WebPushSubscription.objects.count() + NativePushToken.objects.count()
    )

    return {
        "delivered_count": delivered,
        "clicked_count": clicked,
        "open_rate_percent": open_rate,
        "by_category": list(by_category),
        "funnel": {
            "inbox_delivered": PortfolioUserNotification.objects.count(),
            "push_sent": push_sent,
            "push_failed": push_failed,
            "tray_delivered": tray_delivered,
            "tray_clicked": tray_clicked,
        },
        "by_user_type": by_user_type,
        "subscriptions": subs,
    }
