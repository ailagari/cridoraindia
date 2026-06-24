"""Aggregate personal-holdings value change (all pieces together, rate-driven)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import PersonalGoldHolding, PortfolioUserNotification, UserPortfolioNotificationState
from apps.accounts.services.deliver_engagement import deliver_engagement
from apps.accounts.services.engagement_constants import (
    MOMENT_PERSONAL_COLLECTION_DOWN,
    MOMENT_PERSONAL_COLLECTION_GROWTH,
)
from apps.accounts.services.engagement_context import resolve_engagement_context
from apps.accounts.services.notification_rate_limits import gold_alert_allowed, record_gold_alert
from apps.accounts.services.personal_holdings import customer_portfolio_totals_payload
from apps.marketplace.models import get_or_create_ticker

User = get_user_model()
_COOLDOWN_HOURS = 24


def _personal_value_for_user(user: User) -> Decimal:
    totals = customer_portfolio_totals_payload(user)
    return Decimal(str(totals.get("personal_estimated_value_inr") or "0")).quantize(Decimal("0.01"))


def evaluate_personal_collection_change_after_rate_change(*, defer_push: bool = False) -> dict:
    """
    Notify when combined personal gold record value moves vs last baseline.
    Only customers with at least one personal holding.
    """
    ticker = get_or_create_ticker()
    threshold = (ticker.holding_gain_threshold_inr or Decimal("500")).quantize(Decimal("0.01"))
    sent_up = 0
    sent_down = 0
    skipped = 0
    now = timezone.now()
    cooldown_before = now - timedelta(hours=_COOLDOWN_HOURS)

    holder_ids = (
        PersonalGoldHolding.objects.filter(is_removed=False, user__isnull=False)
        .values_list("user_id", flat=True)
        .distinct()
    )

    for user in User.objects.filter(
        pk__in=holder_ids,
        user_type=User.CUSTOMER,
        is_active=True,
    ).iterator(chunk_size=200):
        current = _personal_value_for_user(user)
        if current <= 0:
            skipped += 1
            continue
        if not gold_alert_allowed(user.pk):
            skipped += 1
            continue

        state, created = UserPortfolioNotificationState.objects.get_or_create(
            user=user,
            defaults={"last_notified_personal_value_inr": current},
        )
        if created or state.last_notified_personal_value_inr <= 0:
            state.last_notified_personal_value_inr = current
            state.save(update_fields=["last_notified_personal_value_inr"])
            skipped += 1
            continue

        baseline = state.last_notified_personal_value_inr.quantize(Decimal("0.01"))
        delta = (current - baseline).quantize(Decimal("0.01"))
        if abs(delta) < threshold:
            skipped += 1
            continue
        if state.last_notified_at and state.last_notified_at > cooldown_before:
            skipped += 1
            continue

        ctx = resolve_engagement_context(user)
        change_fmt = f"₹{abs(delta):,.0f}"
        extra = {
            "personal_collection_value": f"₹{current:,.0f}",
            "personal_collection_gain": change_fmt if delta > 0 else "₹0",
            "personal_collection_loss": change_fmt if delta < 0 else "₹0",
            "value_change_amount": change_fmt,
            "rate_direction": "up" if delta > 0 else "down",
        }
        moment = MOMENT_PERSONAL_COLLECTION_GROWTH if delta > 0 else MOMENT_PERSONAL_COLLECTION_DOWN
        row = deliver_engagement(
            user,
            moment=moment,
            context=ctx,
            link_path="/userdashboard?section=portfolio_overview&portfolio_tab=personal",
            category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
            priority=PortfolioUserNotification.PRIORITY_LOW,
            notification_type="personal_collection_change",
            tag=f"pers-coll-{'up' if delta > 0 else 'down'}-{user.pk}",
            defer_push=defer_push,
            extra_facts=extra,
        )
        if not row:
            skipped += 1
            continue

        state.last_notified_personal_value_inr = current
        state.last_notified_at = now
        state.save(update_fields=["last_notified_personal_value_inr", "last_notified_at"])
        record_gold_alert(user.pk)
        if delta > 0:
            sent_up += 1
        else:
            sent_down += 1

    return {"sent_up": sent_up, "sent_down": sent_down, "skipped": skipped}
