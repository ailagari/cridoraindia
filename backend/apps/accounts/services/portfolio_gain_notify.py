"""Aggregate portfolio gain notifications with dedup."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import PortfolioUserNotification, UserPortfolioNotificationState
from apps.accounts.services.inbox_notify import notify_inbox
from apps.accounts.services.notification_copy import format_portfolio_gain
from apps.accounts.services.personal_holdings import customer_portfolio_totals_payload
from apps.marketplace.models import get_or_create_ticker

User = get_user_model()


def run_portfolio_gain_notifications() -> dict:
    ticker = get_or_create_ticker()
    threshold_inr = (ticker.portfolio_gain_threshold_inr or Decimal("500")).quantize(Decimal("0.01"))
    threshold_pct = (ticker.portfolio_gain_threshold_percent or Decimal("2")).quantize(Decimal("0.01"))

    sent = 0
    skipped = 0
    for user in User.objects.filter(user_type=User.CUSTOMER, is_active=True).iterator(chunk_size=200):
        totals = customer_portfolio_totals_payload(user)
        gain_inr = Decimal(str(totals.get("personal_gain_on_recorded_cost_inr") or "0"))
        gain_pct = Decimal(str(totals.get("personal_gain_on_recorded_cost_percent") or "0"))
        if gain_inr < threshold_inr and gain_pct < threshold_pct:
            skipped += 1
            continue

        state, _ = UserPortfolioNotificationState.objects.get_or_create(
            user=user,
            defaults={"last_notified_gain_inr": Decimal("0")},
        )
        incremental = (gain_inr - state.last_notified_gain_inr).quantize(Decimal("0.01"))
        if state.last_notified_at and incremental < threshold_inr:
            skipped += 1
            continue
        if not state.last_notified_at and gain_inr < threshold_inr and gain_pct < threshold_pct:
            skipped += 1
            continue

        notify_inbox(
            user,
            kind=PortfolioUserNotification.KIND_SYSTEM,
            title="Portfolio value update",
            body=format_portfolio_gain(gain_inr),
            link_path="/userdashboard?section=portfolio_overview",
            category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
            priority=PortfolioUserNotification.PRIORITY_LOW,
            notification_type="portfolio_gain",
            tag=f"port-gain-{user.pk}",
        )
        state.last_notified_gain_inr = gain_inr
        state.last_notified_at = timezone.now()
        state.save(update_fields=["last_notified_gain_inr", "last_notified_at"])
        sent += 1

    return {"sent": sent, "skipped": skipped}
