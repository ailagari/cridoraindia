"""In-app portfolio notifications + optional Web Push."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.accounts.models import PortfolioUserNotification
from apps.accounts.services.inbox_notify import notify_inbox

User = get_user_model()


def create_portfolio_notification(
    *,
    user: User,
    kind: str,
    title: str,
    body: str,
    link_path: str = "",
    send_push: bool = True,
    category: str = PortfolioUserNotification.CATEGORY_PORTFOLIO,
    priority: str = PortfolioUserNotification.PRIORITY_MEDIUM,
) -> PortfolioUserNotification:
    return notify_inbox(
        user,
        kind=kind,
        title=title,
        body=body,
        link_path=link_path,
        category=category,
        priority=priority,
        send_push=send_push,
        tag=f"portfolio-{kind}",
    )
