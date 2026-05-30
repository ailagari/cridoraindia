"""Unified per-user inbox row + optional push."""

from __future__ import annotations

import logging

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import NotificationEventLog, PortfolioUserNotification
from apps.accounts.push_payload import build_push_payload
from apps.accounts.services.notification_analytics import log_notification_event
from apps.accounts.services.notification_preferences import should_send_push
from apps.accounts.services.notification_rate_limits import (
    promotional_allowed_for_jeweller,
    record_promotional_jeweller,
)
from apps.accounts.webpush_service import push_delivery_configured, send_push_to_user

logger = logging.getLogger(__name__)
User = get_user_model()


def notify_inbox(
    user: User,
    *,
    kind: str,
    title: str,
    body: str,
    link_path: str = "",
    category: str = PortfolioUserNotification.CATEGORY_PORTFOLIO,
    priority: str = PortfolioUserNotification.PRIORITY_MEDIUM,
    notification_type: str = "",
    send_push: bool = True,
    image_url: str | None = None,
    logo_url: str | None = None,
    jeweller_id: int | None = None,
    tag: str | None = None,
) -> PortfolioUserNotification:
    if category == PortfolioUserNotification.CATEGORY_PROMO and jeweller_id:
        if not promotional_allowed_for_jeweller(jeweller_id):
            send_push = False

    resolved_logo = (logo_url or "").strip()
    resolved_image = (image_url or "").strip()
    if jeweller_id and not resolved_logo:
        from apps.accounts.services.notification_copy import resolve_jeweller_push_branding

        branding = resolve_jeweller_push_branding(jeweller_id)
        resolved_logo = branding.get("logo_url") or ""
    push_image = resolved_image or resolved_logo

    row = PortfolioUserNotification.objects.create(
        user=user,
        kind=kind,
        category=category,
        priority=priority,
        notification_type=notification_type or kind,
        title=title[:180],
        body=body,
        link_path=link_path or "",
        jeweller_id=jeweller_id,
        image_url=resolved_image[:512],
        logo_url=resolved_logo[:512],
        delivered_at=timezone.now(),
    )
    log_notification_event(
        user,
        event_type=NotificationEventLog.EVENT_DELIVERED,
        category=category,
        kind=kind,
        title=title,
    )
    if category == PortfolioUserNotification.CATEGORY_PROMO and jeweller_id:
        record_promotional_jeweller(jeweller_id)

    ntype = notification_type or kind
    if send_push and push_delivery_configured() and should_send_push(
        user, category=category, priority=priority, notification_type=ntype
    ):
        path = link_path if link_path.startswith("/") else f"/{link_path}" if link_path else "/"
        try:
            send_push_to_user(
                user,
                build_push_payload(
                    title=title,
                    body=body,
                    url=path,
                    tag=tag or f"inbox-{kind}-{row.pk}",
                    image_url=push_image or None,
                    notification_id=str(row.pk),
                ),
            )
        except Exception:
            logger.exception("notify_inbox push failed user_id=%s row=%s", user.pk, row.pk)
    return row
