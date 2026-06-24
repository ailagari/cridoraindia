"""Per-item personal holding gain notifications (gain-only)."""

from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import (
    PersonalGoldHolding,
    PersonalHoldingNotificationState,
    PortfolioUserNotification,
)
from apps.accounts.services.deliver_engagement import deliver_engagement
from apps.accounts.services.engagement_constants import (
    MOMENT_HOLDING_APPRECIATION,
    MOMENT_HOLDING_VALUE_DOWN,
)
from apps.accounts.services.engagement_context import resolve_engagement_context
from apps.accounts.services.notification_copy import resolve_jeweller_push_branding
from apps.accounts.services.notification_rate_limits import gold_alert_allowed, record_gold_alert
from apps.accounts.services.personal_holdings import calculate_holding_value_inr, reference_gold_rate_inr_per_gram
from apps.marketplace.models import get_or_create_ticker, jeweller_profile_for
from apps.marketplace.pricing import reference_metal_rate_inr_per_gram_for_jeweller

logger = logging.getLogger(__name__)
User = get_user_model()
_HOLDING_COOLDOWN_HOURS = 24


def _rate_for_holding(holding: PersonalGoldHolding, jeweller_id: int | None) -> Decimal:
    if jeweller_id and holding.jeweller_id == jeweller_id:
        profile = jeweller_profile_for(holding.jeweller)
        base, _ = reference_gold_rate_inr_per_gram()
        return reference_metal_rate_inr_per_gram_for_jeweller(profile, base)
    return reference_gold_rate_inr_per_gram()[0]


def _get_or_init_state(holding: PersonalGoldHolding, new_value: Decimal) -> PersonalHoldingNotificationState:
    state, created = PersonalHoldingNotificationState.objects.get_or_create(
        holding=holding,
        defaults={"last_notified_value_inr": holding.estimated_current_value_inr or new_value},
    )
    if created and (holding.estimated_current_value_inr or Decimal("0")) > 0:
        state.last_notified_value_inr = holding.estimated_current_value_inr
        state.save(update_fields=["last_notified_value_inr"])
    return state


def notify_personal_holdings_after_rate_change(
    *,
    jeweller_id: int | None = None,
    defer_push: bool = False,
) -> int:
    """
    After a platform or jeweller rate move, notify customers per holding when gain exceeds threshold.
    Gain-only; max one alert per holding per 24h.
    """
    ticker = get_or_create_ticker()
    threshold = (ticker.holding_gain_threshold_inr or Decimal("500")).quantize(Decimal("0.01"))
    qs = PersonalGoldHolding.objects.filter(is_removed=False).select_related("user", "jeweller")
    if jeweller_id:
        qs = qs.filter(jeweller_id=jeweller_id)

    sent = 0
    now = timezone.now()
    cooldown_before = now - timedelta(hours=_HOLDING_COOLDOWN_HOURS)

    for holding in qs.iterator(chunk_size=200):
        user = holding.user
        if user is None or not user.is_active or user.user_type != User.CUSTOMER:
            continue
        if not gold_alert_allowed(user.pk):
            continue

        rate = _rate_for_holding(holding, jeweller_id)
        new_value = calculate_holding_value_inr(holding.weight_grams, rate)
        state = _get_or_init_state(holding, new_value)
        baseline = state.last_notified_value_inr.quantize(Decimal("0.01"))
        gain = (new_value - baseline).quantize(Decimal("0.01"))
        if gain >= threshold:
            moment = MOMENT_HOLDING_APPRECIATION
            notification_type = "holding_gain"
            tag = f"hold-gain-{holding.pk}"
        elif gain <= -threshold:
            moment = MOMENT_HOLDING_VALUE_DOWN
            notification_type = "holding_value_down"
            tag = f"hold-down-{holding.pk}"
        else:
            continue
        if state.last_notified_at and state.last_notified_at > cooldown_before:
            continue

        branding = resolve_jeweller_push_branding(holding.jeweller_id) if holding.jeweller_id else {}
        ctx = resolve_engagement_context(user)
        loss_abs = abs(gain) if gain < 0 else Decimal("0")
        row = deliver_engagement(
            user,
            moment=moment,
            context=ctx,
            holding=holding,
            gain_inr=gain if gain > 0 else None,
            value_inr=new_value,
            link_path="/userdashboard?section=portfolio_holdings",
            category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
            priority=PortfolioUserNotification.PRIORITY_LOW,
            notification_type=notification_type,
            jeweller_id=holding.jeweller_id,
            logo_url=branding.get("logo_url") or None,
            image_url=branding.get("logo_url") or None,
            tag=tag,
            defer_push=defer_push,
            extra_facts={
                "holding_loss_amount": f"₹{loss_abs:,.0f}" if loss_abs else "₹0",
                "value_change_amount": f"₹{abs(gain):,.0f}",
            },
        )
        if not row:
            continue
        state.last_notified_value_inr = new_value
        state.last_notified_at = now
        state.save(update_fields=["last_notified_value_inr", "last_notified_at"])
        holding.estimated_current_value_inr = new_value
        holding.save(update_fields=["estimated_current_value_inr"])
        record_gold_alert(user.pk)
        sent += 1

    return sent
