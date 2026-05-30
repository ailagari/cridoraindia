"""Aggregate portfolio gain notifications with dedup."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import PortfolioUserNotification, UserPortfolioNotificationState
from apps.accounts.services.deliver_engagement import deliver_engagement
from apps.accounts.services.engagement_constants import MOMENT_PORTFOLIO_GROWTH
from apps.accounts.services.engagement_context import resolve_engagement_context
from apps.accounts.services.notification_rate_limits import portfolio_alert_allowed, record_portfolio_alert
from apps.accounts.services.personal_holdings import customer_portfolio_totals_payload
from apps.marketplace.models import get_or_create_ticker

User = get_user_model()


def evaluate_portfolio_gains_after_rate_change(*, defer_push: bool = False) -> dict:
    return _run_portfolio_gain_scan(defer_push=defer_push)


def run_portfolio_gain_notifications() -> dict:
    """Deprecated for live market alerts; use evaluate_portfolio_gains_after_rate_change on ingest."""
    return _run_portfolio_gain_scan(defer_push=False)


def _run_portfolio_gain_scan(*, defer_push: bool) -> dict:
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
        if not portfolio_alert_allowed(user.pk):
            skipped += 1
            continue

        ctx = resolve_engagement_context(user)
        row = deliver_engagement(
            user,
            moment=MOMENT_PORTFOLIO_GROWTH,
            context=ctx,
            link_path="/userdashboard?section=portfolio_overview",
            category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
            priority=PortfolioUserNotification.PRIORITY_LOW,
            notification_type="portfolio_gain",
            tag=f"port-gain-{user.pk}",
            defer_push=defer_push,
            extra_facts={
                "portfolio_gain_amount": str(gain_inr.quantize(Decimal("0.01"))),
            },
        )
        if not row:
            skipped += 1
            continue
        record_portfolio_alert(user.pk)
        state.last_notified_gain_inr = gain_inr
        state.last_notified_at = timezone.now()
        state.save(update_fields=["last_notified_gain_inr", "last_notified_at"])
        sent += 1

    return {"sent": sent, "skipped": skipped}
