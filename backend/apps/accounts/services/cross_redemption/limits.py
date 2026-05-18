"""Daily usage and tier checks for source-jeweller cross-redemption limits."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.utils import timezone

from apps.accounts.models import CrossRedemptionRequest, JewellerCrossPolicy

User = get_user_model()

_ACTIVE_STAGES = (
    CrossRedemptionRequest.LifecycleStage.AUTH,
    CrossRedemptionRequest.LifecycleStage.FULFILLMENT,
    CrossRedemptionRequest.LifecycleStage.SETTLEMENT,
)


def _day_start() -> datetime:
    return timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)


def source_daily_usage(source_jeweller_id: int) -> dict[str, Decimal | int]:
    """Grams, INR, and count for today's non-failed cross-redemptions from this source."""
    qs = CrossRedemptionRequest.objects.filter(
        source_jeweller_id=source_jeweller_id,
        created_at__gte=_day_start(),
    ).exclude(
        lifecycle_stage=CrossRedemptionRequest.LifecycleStage.CLOSED,
        outcome=CrossRedemptionRequest.Outcome.FAILURE,
    )
    agg = qs.aggregate(
        grams=Sum("grams"),
        inr=Sum("estimated_value_snapshot_inr"),
        cnt=Count("id"),
    )
    grams = agg["grams"] or Decimal("0")
    inr = agg["inr"] or Decimal("0")
    cnt = agg["cnt"] or 0
    return {"grams": grams, "inr": inr, "count": cnt}


def classify_auth_tier(
    policy: JewellerCrossPolicy,
    *,
    grams: Decimal,
    inr: Decimal,
    source_jeweller_id: int,
) -> tuple[str, list[str]]:
    """
    Returns (tier, reason_codes).
    tier: auto | manual | reject
    """
    reasons: list[str] = []
    if not policy.allow_cross_redemption:
        return "reject", ["cross_disabled"]

    if policy.single_txn_gram_limit > 0 and grams > policy.single_txn_gram_limit:
        reasons.append("single_txn_grams")
    if policy.single_txn_inr_limit > 0 and inr > policy.single_txn_inr_limit:
        reasons.append("single_txn_inr")

    usage = source_daily_usage(source_jeweller_id)
    u_g = usage["grams"] + grams
    u_i = usage["inr"] + inr
    u_c = int(usage["count"]) + 1

    if policy.auto_cross_grams_per_day > 0 and u_g > policy.auto_cross_grams_per_day:
        reasons.append("daily_grams")
    if policy.auto_cross_inr_per_day > 0 and u_i > policy.auto_cross_inr_per_day:
        reasons.append("daily_inr")
    if policy.daily_txn_count_limit > 0 and u_c > policy.daily_txn_count_limit:
        reasons.append("daily_count")

    if policy.require_source_approval:
        reasons.append("manual_policy")

    if reasons:
        return "manual", reasons
    return "auto", []
