"""Event-driven portfolio and holding milestone engagement."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from apps.accounts.models import (
    PersonalGoldHolding,
    PersonalHoldingNotificationState,
    PortfolioUserNotification,
    UserPortfolioNotificationState,
)
from apps.accounts.services.deliver_engagement import deliver_engagement
from apps.accounts.services.engagement_constants import (
    MOMENT_HOLDING_MILESTONE,
    MOMENT_PORTFOLIO_MILESTONE,
)
from apps.accounts.services.engagement_context import resolve_engagement_context
from apps.accounts.services.notification_rate_limits import portfolio_alert_allowed, record_portfolio_alert
from apps.accounts.services.personal_holdings import customer_portfolio_totals_payload
from apps.marketplace.models import get_or_create_ticker

User = get_user_model()


def _parse_thresholds(raw) -> list[Decimal]:
    out: list[Decimal] = []
    if not isinstance(raw, list):
        return [Decimal("100000")]
    for item in raw:
        try:
            out.append(Decimal(str(item)).quantize(Decimal("0.01")))
        except Exception:
            continue
    return sorted(set(out)) or [Decimal("100000")]


def evaluate_portfolio_milestones_after_rate_change(*, defer_push: bool = False) -> int:
    ticker = get_or_create_ticker()
    thresholds = _parse_thresholds(ticker.portfolio_milestone_thresholds_inr)
    sent = 0
    for user in User.objects.filter(user_type=User.CUSTOMER, is_active=True).iterator(chunk_size=200):
        if not portfolio_alert_allowed(user.pk):
            continue
        totals = customer_portfolio_totals_payload(user)
        value = Decimal(str(totals.get("total_estimated_value_inr") or "0")).quantize(Decimal("0.01"))
        state, _ = UserPortfolioNotificationState.objects.get_or_create(
            user=user,
            defaults={"last_milestone_portfolio_value_inr": Decimal("0")},
        )
        prev_milestone = state.last_milestone_portfolio_value_inr.quantize(Decimal("0.01"))
        crossed = None
        for th in thresholds:
            if prev_milestone < th <= value:
                crossed = th
        if crossed is None:
            continue
        ctx = resolve_engagement_context(user)
        row = deliver_engagement(
            user,
            moment=MOMENT_PORTFOLIO_MILESTONE,
            context=ctx,
            link_path="/userdashboard?section=portfolio_overview",
            category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
            priority=PortfolioUserNotification.PRIORITY_LOW,
            notification_type="portfolio_milestone",
            tag=f"port-milestone-{user.pk}-{int(crossed)}",
            defer_push=defer_push,
            extra_facts={"milestone_threshold": str(int(crossed))},
        )
        if row:
            state.last_milestone_portfolio_value_inr = value
            state.save(update_fields=["last_milestone_portfolio_value_inr"])
            record_portfolio_alert(user.pk)
            sent += 1
    return sent


def evaluate_holding_milestones_after_rate_change(
    *,
    jeweller_id: int | None = None,
    defer_push: bool = False,
) -> int:
    ticker = get_or_create_ticker()
    threshold = (ticker.holding_milestone_threshold_inr or Decimal("100000")).quantize(Decimal("0.01"))
    qs = PersonalGoldHolding.objects.filter(is_removed=False).select_related("user")
    if jeweller_id:
        qs = qs.filter(jeweller_id=jeweller_id)

    sent = 0
    for holding in qs.iterator(chunk_size=200):
        user = holding.user
        if user is None or not user.is_active or user.user_type != User.CUSTOMER:
            continue
        if not portfolio_alert_allowed(user.pk):
            continue
        value = (holding.estimated_current_value_inr or Decimal("0")).quantize(Decimal("0.01"))
        if value < threshold:
            continue
        state, _ = PersonalHoldingNotificationState.objects.get_or_create(
            holding=holding,
            defaults={"last_milestone_value_inr": Decimal("0")},
        )
        prev = state.last_milestone_value_inr.quantize(Decimal("0.01"))
        if prev >= threshold:
            continue
        ctx = resolve_engagement_context(user)
        row = deliver_engagement(
            user,
            moment=MOMENT_HOLDING_MILESTONE,
            context=ctx,
            holding=holding,
            value_inr=value,
            link_path="/userdashboard?section=portfolio_holdings",
            category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
            priority=PortfolioUserNotification.PRIORITY_LOW,
            notification_type="holding_milestone",
            jeweller_id=holding.jeweller_id,
            tag=f"hold-milestone-{holding.pk}",
            defer_push=defer_push,
        )
        if row:
            state.last_milestone_value_inr = value
            state.save(update_fields=["last_milestone_value_inr"])
            record_portfolio_alert(user.pk)
            sent += 1
    return sent
