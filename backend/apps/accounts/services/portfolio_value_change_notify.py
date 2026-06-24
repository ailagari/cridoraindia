"""Total portfolio estimated value change alerts (rate-driven, up and down)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import PortfolioUserNotification, UserPortfolioNotificationState
from apps.accounts.services.deliver_engagement import deliver_engagement
from apps.accounts.services.engagement_constants import (
    MOMENT_PORTFOLIO_VALUE_DOWN,
    MOMENT_PORTFOLIO_VALUE_UP,
)
from apps.accounts.services.engagement_context import resolve_engagement_context
from apps.accounts.services.notification_rate_limits import portfolio_alert_allowed, record_portfolio_alert
from apps.accounts.services.personal_holdings import customer_portfolio_totals_payload
from apps.marketplace.models import get_or_create_ticker

User = get_user_model()
_COOLDOWN_HOURS = 24


def evaluate_portfolio_value_change_after_rate_change(*, defer_push: bool = False) -> dict:
    """
    Notify when total estimated portfolio value moves vs last notified baseline.
    Separate calm copy for increases and decreases.
    """
    ticker = get_or_create_ticker()
    threshold = (ticker.holding_gain_threshold_inr or Decimal("500")).quantize(Decimal("0.01"))
    sent_up = 0
    sent_down = 0
    skipped = 0
    now = timezone.now()
    cooldown_before = now - timedelta(hours=_COOLDOWN_HOURS)

    for user in User.objects.filter(user_type=User.CUSTOMER, is_active=True).iterator(chunk_size=200):
        totals = customer_portfolio_totals_payload(user)
        current = Decimal(str(totals.get("total_estimated_value_inr") or "0")).quantize(Decimal("0.01"))
        if current <= 0:
            skipped += 1
            continue

        state, created = UserPortfolioNotificationState.objects.get_or_create(
            user=user,
            defaults={"last_notified_total_value_inr": current},
        )
        if created or state.last_notified_total_value_inr <= 0:
            state.last_notified_total_value_inr = current
            state.save(update_fields=["last_notified_total_value_inr"])
            skipped += 1
            continue

        baseline = state.last_notified_total_value_inr.quantize(Decimal("0.01"))
        delta = (current - baseline).quantize(Decimal("0.01"))
        if abs(delta) < threshold:
            skipped += 1
            continue
        if state.last_notified_at and state.last_notified_at > cooldown_before:
            skipped += 1
            continue
        if not portfolio_alert_allowed(user.pk):
            skipped += 1
            continue

        ctx = resolve_engagement_context(user)
        change_fmt = f"₹{abs(delta):,.0f}"
        extra = {
            "value_change_amount": change_fmt,
            "rate_direction": "up" if delta > 0 else "down",
        }
        moment = MOMENT_PORTFOLIO_VALUE_UP if delta > 0 else MOMENT_PORTFOLIO_VALUE_DOWN
        row = deliver_engagement(
            user,
            moment=moment,
            context=ctx,
            link_path="/userdashboard?section=portfolio_overview",
            category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
            priority=PortfolioUserNotification.PRIORITY_LOW,
            notification_type="portfolio_value_change",
            tag=f"port-val-{'up' if delta > 0 else 'down'}-{user.pk}",
            defer_push=defer_push,
            extra_facts=extra,
        )
        if not row:
            skipped += 1
            continue

        state.last_notified_total_value_inr = current
        state.last_notified_at = now
        state.save(update_fields=["last_notified_total_value_inr", "last_notified_at"])
        record_portfolio_alert(user.pk)
        if delta > 0:
            sent_up += 1
        else:
            sent_down += 1

    return {"sent_up": sent_up, "sent_down": sent_down, "skipped": skipped}
