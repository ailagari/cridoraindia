"""Notify a jeweller when a customer switches primary jeweller away from them."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.accounts.models import PortfolioUserNotification, User
from apps.accounts.services.inbox_notify import notify_inbox

UserModel = get_user_model()


def notify_previous_primary_jeweller(
    *,
    customer: User,
    previous_jeweller_id: int,
    new_jeweller: User,
) -> None:
    previous = UserModel.objects.filter(
        pk=previous_jeweller_id,
        user_type=User.JEWELLER,
    ).first()
    if not previous or previous.pk == new_jeweller.pk:
        return
    customer_label = f"{customer.first_name} {customer.last_name}".strip() or customer.email
    new_label = (new_jeweller.business_name or "").strip() or new_jeweller.email
    notify_inbox(
        previous,
        kind="primary_customer_changed",
        title="Primary customer changed",
        body=(
            f"{customer_label} set {new_label} as their primary jeweller "
            f"instead of your shop."
        ),
        link_path="/dashboard/jeweller?section=cust_hub",
        category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
        priority=PortfolioUserNotification.PRIORITY_MEDIUM,
        notification_type="primary_customer_changed",
    )
