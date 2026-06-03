"""Persist push send outcomes and tray acknowledgements."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.accounts.models import PortfolioUserNotification, PushDeliveryAttempt

User = get_user_model()


def _resolve_portfolio_notification(
    notification_id: int | None,
) -> PortfolioUserNotification | None:
    if not notification_id:
        return None
    return PortfolioUserNotification.objects.filter(pk=notification_id).first()


def log_push_attempt(
    *,
    user: User | None,
    channel: str,
    status: str,
    notification_id: int | None = None,
    tag: str = "",
    error_message: str = "",
) -> PushDeliveryAttempt:
    row = _resolve_portfolio_notification(notification_id)
    return PushDeliveryAttempt.objects.create(
        user=user or (row.user if row else None),
        portfolio_notification=row,
        channel=channel,
        status=status,
        tag=(tag or "")[:64],
        error_message=(error_message or "")[:255],
    )


def log_tray_ack(
    *,
    event: str,
    notification_id: int | None = None,
    tag: str = "",
    user: User | None = None,
) -> PushDeliveryAttempt | None:
    status = (
        PushDeliveryAttempt.STATUS_TRAY_CLICKED
        if event == "tray_clicked"
        else PushDeliveryAttempt.STATUS_TRAY_DELIVERED
    )
    row = _resolve_portfolio_notification(notification_id)
    owner = user or (row.user if row else None)
    if owner is None and not row:
        return None
    return PushDeliveryAttempt.objects.create(
        user=owner,
        portfolio_notification=row,
        channel=PushDeliveryAttempt.CHANNEL_WEBPUSH,
        status=status,
        tag=(tag or "")[:64],
    )
