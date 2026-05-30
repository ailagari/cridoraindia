"""Handle GoldPriceUpdated: metrics, rules, queued push delivery."""

from __future__ import annotations

import logging
from decimal import Decimal

from django.contrib.auth import get_user_model

from apps.accounts.services.portfolio_gain_notify import evaluate_portfolio_gains_after_rate_change
from apps.marketplace.gold_price_events import GoldPriceUpdated
from apps.marketplace.gold_rate_alerts import evaluate_platform_threshold_broadcast
from apps.marketplace.gold_hourly_push import evaluate_hourly_digest_on_price_ingest
from apps.marketplace.platform_gold_notify import (
    notify_customers_platform_gold_move,
    record_platform_gold_rate_history,
)

logger = logging.getLogger(__name__)
User = get_user_model()


def recalculate_affected_holdings(*, jeweller_id: int | None, new_platform_rate: Decimal) -> int:
    from apps.accounts.models import PersonalGoldHolding
    from apps.accounts.services.personal_holdings import calculate_holding_value_inr
    from apps.accounts.services.personal_holding_gain_notify import _rate_for_holding

    qs = PersonalGoldHolding.objects.filter(is_removed=False)
    if jeweller_id:
        qs = qs.filter(jeweller_id=jeweller_id)
    updated = 0
    for holding in qs.iterator(chunk_size=200):
        rate = _rate_for_holding(holding, jeweller_id)
        value = calculate_holding_value_inr(holding.weight_grams, rate)
        if holding.estimated_current_value_inr != value:
            holding.estimated_current_value_inr = value
            holding.save(update_fields=["estimated_current_value_inr"])
            updated += 1
    return updated


def handle_gold_price_updated(event: GoldPriceUpdated) -> dict:
    out: dict = {"scope": event.scope, "skipped": False}
    if event.scope == "platform":
        out.update(_handle_platform(event))
    elif event.scope == "jeweller" and event.jeweller_id:
        out.update(_handle_jeweller(event))
    return out


def _handle_platform(event: GoldPriceUpdated) -> dict:
    result: dict = {"holdings_recalculated": 0}
    if event.previous_rate is None:
        result["skipped"] = "first_ingest_baseline_only"
        recalculate_affected_holdings(jeweller_id=None, new_platform_rate=event.new_rate)
        return result

    if event.previous_rate == event.new_rate:
        result["skipped"] = "unchanged"
        return result

    result["holdings_recalculated"] = recalculate_affected_holdings(
        jeweller_id=None,
        new_platform_rate=event.new_rate,
    )

    threshold = evaluate_platform_threshold_broadcast(
        previous_rate=event.previous_rate,
        new_rate=event.new_rate,
    )
    result["threshold"] = threshold

    if threshold.get("sent"):
        baseline = event.previous_rate
        current = event.new_rate
        from apps.marketplace.models import get_or_create_ticker

        ticker = get_or_create_ticker()
        title = (ticker.rate_move_alert_title or "Gold rate alert").strip() or "Gold rate alert"
        link = (ticker.rate_move_alert_link or "/marketplace").strip() or "/marketplace"
        image_url = (ticker.gold_push_image_url or "").strip()
        try:
            record_platform_gold_rate_history(previous_rate=baseline, new_rate=current)
        except Exception:
            logger.exception("platform GoldRateHistory insert failed")
        result["customer_inbox_sent"] = notify_customers_platform_gold_move(
            baseline=baseline,
            current=current,
            title=title,
            link=link,
            image_url=image_url,
            defer_push=True,
        )

    result["hourly_digest"] = evaluate_hourly_digest_on_price_ingest(new_rate=event.new_rate)

    from apps.accounts.services.personal_holding_gain_notify import (
        notify_personal_holdings_after_rate_change,
    )

    result["holding_alerts_sent"] = notify_personal_holdings_after_rate_change(
        jeweller_id=None,
        defer_push=True,
    )
    result["portfolio_alerts_sent"] = evaluate_portfolio_gains_after_rate_change(defer_push=True)
    from apps.accounts.services.engagement_milestones import (
        evaluate_holding_milestones_after_rate_change,
        evaluate_portfolio_milestones_after_rate_change,
    )
    from apps.accounts.services.engagement_educational import maybe_send_educational_engagement
    from apps.accounts.services.engagement_facts import build_monthly_storytelling_facts

    result["portfolio_milestones_sent"] = evaluate_portfolio_milestones_after_rate_change(
        defer_push=True
    )
    result["holding_milestones_sent"] = evaluate_holding_milestones_after_rate_change(
        jeweller_id=None,
        defer_push=True,
    )
    result["educational_sent"] = maybe_send_educational_engagement(defer_push=True)
    result["monthly_storytelling_built"] = True
    return result


def _handle_jeweller(event: GoldPriceUpdated) -> dict:
    from apps.marketplace.jeweller_gold_rate_notify import deliver_jeweller_rate_notifications

    result = deliver_jeweller_rate_notifications(
        jeweller_id=event.jeweller_id,
        previous_rate=event.previous_rate,
        new_rate=event.new_rate,
        updated_by_id=event.updated_by_id,
        defer_push=True,
    )
    result["holdings_recalculated"] = recalculate_affected_holdings(
        jeweller_id=event.jeweller_id,
        new_platform_rate=event.new_rate,
    )
    from apps.accounts.services.engagement_milestones import evaluate_holding_milestones_after_rate_change

    result["holding_milestones_sent"] = evaluate_holding_milestones_after_rate_change(
        jeweller_id=event.jeweller_id,
        defer_push=True,
    )
    return result
