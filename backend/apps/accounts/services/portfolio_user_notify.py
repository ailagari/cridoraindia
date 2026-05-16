"""In-app portfolio notifications + optional Web Push."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.accounts.models import PortfolioUserNotification
from apps.accounts.webpush_service import send_push_to_user

User = get_user_model()


def create_portfolio_notification(
    *,
    user: User,
    kind: str,
    title: str,
    body: str,
    link_path: str = "",
    send_push: bool = True,
) -> PortfolioUserNotification:
    row = PortfolioUserNotification.objects.create(
        user=user,
        kind=kind,
        title=title,
        body=body,
        link_path=link_path or "",
    )
    if send_push:
        url = link_path if link_path.startswith("/") else f"/{link_path}" if link_path else "/userdashboard"
        send_push_to_user(
            user,
            {
                "title": title,
                "body": body,
                "url": url,
                "tag": f"portfolio-{kind}",
            },
        )
    return row
