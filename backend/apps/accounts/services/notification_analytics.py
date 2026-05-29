"""Append-only notification analytics (survives inbox delete-on-read)."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.accounts.models import NotificationEventLog

User = get_user_model()


def log_notification_event(
    user: User | None,
    *,
    event_type: str,
    category: str = "",
    kind: str = "",
    title: str = "",
) -> None:
    NotificationEventLog.objects.create(
        user=user,
        event_type=event_type,
        category=category[:24],
        kind=kind[:32],
        title=(title or "")[:180],
    )
