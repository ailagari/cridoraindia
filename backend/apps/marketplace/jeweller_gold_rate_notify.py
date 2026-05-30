"""Notify jeweller customers when manual gold rate moves beyond threshold."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import PortfolioUserNotification
from apps.accounts.services.campaign_audience import (
    TARGET_DEFAULT_JEWELLER_USERS,
    resolve_campaign_user_ids,
)
from apps.accounts.services.inbox_notify import notify_inbox
from apps.accounts.services.notification_copy import (
    format_gold_rate_standard,
    resolve_jeweller_push_branding,
)
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
    if profile.gold_rate_source != JewellerPricingProfile.GOLD_RATE_MANUAL:
        return 0
    if previous_rate is None:
        return 0
    threshold = (threshold_inr or DEFAULT_THRESHOLD_INR).quantize(Decimal("0.01"))
    prev = previous_rate.quantize(Decimal("0.01"))
    new = new_rate.quantize(Decimal("0.01"))
    delta = (new - prev).quantize(Decimal("0.01"))
    if abs(delta) < threshold:
        return 0

    pct = Decimal("0")
    if prev > 0:
        pct = ((delta / prev) * Decimal("100")).quantize(Decimal("0.01"))

    GoldRateHistory.objects.create(
        jeweller=profile.jeweller,
        previous_rate=prev,
        new_rate=new,
        difference=delta,
        difference_percentage=pct,
        updated_by=updated_by,
        effective_from=timezone.now(),
    )

    branding = resolve_jeweller_push_branding(profile.jeweller_id)
    title = f"{branding['title_prefix']}: Gold rate updated" if branding.get("title_prefix") else "Gold rate updated"
    body = format_gold_rate_standard(previous_rate=prev, new_rate=new)
    logo = branding.get("logo_url") or ""
    sent = 0
    for uid in resolve_campaign_user_ids(
        TARGET_DEFAULT_JEWELLER_USERS,
        {"jeweller_id": profile.jeweller_id},
    ):
        user = User.objects.filter(pk=uid, is_active=True).first()
        if user is None:
            continue
        notify_inbox(
            user,
            kind=PortfolioUserNotification.KIND_SYSTEM,
            title=title[:180],
            body=body,
            link_path="/userdashboard?section=shop_jewellers",
            category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
            priority=PortfolioUserNotification.PRIORITY_MEDIUM,
            notification_type="gold_rate",
            jeweller_id=profile.jeweller_id,
            logo_url=logo or None,
            image_url=logo or None,
            tag=f"jgold-rate-{profile.jeweller_id}",
        )
        sent += 1

    try:
        from apps.accounts.services.personal_holding_gain_notify import (
            notify_personal_holdings_after_rate_change,
        )

        notify_personal_holdings_after_rate_change(jeweller_id=profile.jeweller_id)
    except Exception:
        import logging

        logging.getLogger(__name__).exception("holding gain after jeweller rate failed")

    return sent
