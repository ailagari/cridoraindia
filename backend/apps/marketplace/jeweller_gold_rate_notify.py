"""Jeweller manual rate notifications (event-driven)."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import PortfolioUserNotification
from apps.accounts.services.campaign_audience import (
    TARGET_DEFAULT_JEWELLER_USERS,
    resolve_campaign_user_ids,
)
from apps.accounts.services.deliver_engagement import deliver_engagement
from apps.accounts.services.engagement_constants import MOMENT_MARKET_AWARENESS
from apps.accounts.services.engagement_context import resolve_engagement_context
from apps.accounts.services.notification_copy import resolve_jeweller_push_branding
from apps.marketplace.models import GoldRateHistory, JewellerPricingProfile

User = get_user_model()
DEFAULT_THRESHOLD_INR = Decimal("10")


def maybe_notify_jeweller_gold_rate_change(
    profile: JewellerPricingProfile,
    *,
    previous_rate: Decimal | None,
    new_rate: Decimal,
    updated_by: User | None = None,
    threshold_inr: Decimal | None = None,
) -> int:
    """Publish GoldPriceUpdated when manual jeweller rate changes."""
    if profile.gold_rate_source != JewellerPricingProfile.GOLD_RATE_MANUAL:
        return 0
    if previous_rate is None:
        return 0
    prev = previous_rate.quantize(Decimal("0.01"))
    new = new_rate.quantize(Decimal("0.01"))
    if prev == new:
        return 0

    from apps.marketplace.gold_price_events import publish_jeweller_gold_price_updated

    publish_jeweller_gold_price_updated(
        jeweller_id=profile.jeweller_id,
        previous_rate=prev,
        new_rate=new,
        updated_by=updated_by,
    )
    return 1


def deliver_jeweller_rate_notifications(
    *,
    jeweller_id: int,
    previous_rate: Decimal | None,
    new_rate: Decimal,
    updated_by_id: int | None = None,
    threshold_inr: Decimal | None = None,
    defer_push: bool = False,
) -> dict:
    if previous_rate is None:
        return {"sent": 0, "skipped": "no_previous_rate"}

    threshold = (threshold_inr or DEFAULT_THRESHOLD_INR).quantize(Decimal("0.01"))
    prev = previous_rate.quantize(Decimal("0.01"))
    new = new_rate.quantize(Decimal("0.01"))
    delta = (new - prev).quantize(Decimal("0.01"))
    if abs(delta) < threshold:
        return {"sent": 0, "skipped": "below_threshold"}

    updated_by = None
    if updated_by_id:
        updated_by = User.objects.filter(pk=updated_by_id).first()

    pct = Decimal("0")
    if prev > 0:
        pct = ((delta / prev) * Decimal("100")).quantize(Decimal("0.01"))

    GoldRateHistory.objects.create(
        jeweller_id=jeweller_id,
        previous_rate=prev,
        new_rate=new,
        difference=delta,
        difference_percentage=pct,
        updated_by=updated_by,
        effective_from=timezone.now(),
    )

    branding = resolve_jeweller_push_branding(jeweller_id)
    title = f"{branding['title_prefix']}: Gold rate updated" if branding.get("title_prefix") else "Gold rate updated"
    logo = branding.get("logo_url") or ""
    sent = 0
    for uid in resolve_campaign_user_ids(
        TARGET_DEFAULT_JEWELLER_USERS,
        {"jeweller_id": jeweller_id},
    ):
        user = User.objects.filter(pk=uid, is_active=True).first()
        if user is None:
            continue
        ctx = resolve_engagement_context(user)
        row = deliver_engagement(
            user,
            moment=MOMENT_MARKET_AWARENESS,
            context=ctx,
            previous_rate=prev,
            new_rate=new,
            title_override=title[:180],
            link_path="/userdashboard?section=shop_jewellers",
            category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
            priority=PortfolioUserNotification.PRIORITY_MEDIUM,
            notification_type="gold_rate",
            jeweller_id=jeweller_id,
            logo_url=logo or None,
            image_url=logo or None,
            tag=f"jgold-rate-{jeweller_id}",
            defer_push=defer_push,
        )
        if row:
            sent += 1

    from apps.accounts.services.personal_holding_gain_notify import (
        notify_personal_holdings_after_rate_change,
    )

    holding_sent = notify_personal_holdings_after_rate_change(
        jeweller_id=jeweller_id,
        defer_push=defer_push,
    )
    return {"sent": sent, "holding_alerts_sent": holding_sent}
