"""Platform 22K rate move: public broadcast + customer inbox after threshold alert."""

from __future__ import annotations

import logging
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from apps.accounts.models import GoldDepositIntake, PersonalGoldHolding, PortfolioUserNotification
from apps.accounts.services.deliver_engagement import deliver_engagement
from apps.accounts.services.notification_locale import resolve_user_notification_locale
from apps.accounts.services.engagement_constants import (
    MOMENT_MARKET_RATE_DOWN,
    MOMENT_MARKET_RATE_UP,
)
from apps.accounts.services.engagement_context import resolve_engagement_context
from apps.accounts.services.notification_rate_limits import gold_alert_allowed, record_gold_alert
from apps.marketplace.models import GoldRateHistory

logger = logging.getLogger(__name__)
User = get_user_model()


def _customers_with_holdings_qs():
    has_personal = PersonalGoldHolding.objects.filter(
        user_id=OuterRef("pk"), is_removed=False
    )
    has_deposit = GoldDepositIntake.objects.filter(
        customer_id=OuterRef("pk"),
        status=GoldDepositIntake.COMPLETED,
    )
    from apps.accounts.models import FractionalGoldPurchase

    has_fractional = FractionalGoldPurchase.objects.filter(customer_id=OuterRef("pk"))
    return User.objects.filter(
        user_type=User.CUSTOMER,
        is_active=True,
    ).filter(
        Q(Exists(has_personal)) | Q(Exists(has_deposit)) | Q(Exists(has_fractional))
    )


def record_platform_gold_rate_history(
    *,
    previous_rate: Decimal,
    new_rate: Decimal,
    updated_by=None,
) -> None:
    delta = (new_rate - previous_rate).quantize(Decimal("0.01"))
    pct = Decimal("0")
    if previous_rate > 0:
        pct = ((delta / previous_rate) * Decimal("100")).quantize(Decimal("0.01"))
    GoldRateHistory.objects.create(
        jeweller=None,
        previous_rate=previous_rate.quantize(Decimal("0.01")),
        new_rate=new_rate.quantize(Decimal("0.01")),
        difference=delta,
        difference_percentage=pct,
        updated_by=updated_by,
        effective_from=timezone.now(),
    )


def notify_customers_platform_gold_move(
    *,
    baseline: Decimal,
    current: Decimal,
    link: str,
    image_url: str,
    body: str | None = None,
    defer_push: bool = False,
) -> int:
    """Inbox + tray for customers with holdings (preferences + daily cap)."""
    sent = 0
    delta_sign = (current - baseline).quantize(Decimal("0.01"))
    moment = MOMENT_MARKET_RATE_UP if delta_sign > 0 else MOMENT_MARKET_RATE_DOWN
    for user in _customers_with_holdings_qs().iterator(chunk_size=100):
        if not gold_alert_allowed(user.pk):
            continue
        ctx = resolve_engagement_context(user)
        row = deliver_engagement(
            user,
            moment=moment,
            context=ctx,
            previous_rate=baseline,
            new_rate=current,
            link_path=link,
            category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
            priority=PortfolioUserNotification.PRIORITY_MEDIUM,
            notification_type="gold_rate_up" if delta_sign > 0 else "gold_rate_down",
            image_url=image_url or None,
            tag="cridora-gold-rate-inbox",
            defer_push=defer_push,
            extra_facts={"rate_direction": "up" if delta_sign > 0 else "down"},
        )
        if body and row and resolve_user_notification_locale(user) == "en":
            row.body = body
            row.save(update_fields=["body"])
        if row:
            record_gold_alert(user.pk)
            sent += 1
    return sent


def run_platform_gold_rate_notifications(*, force: bool = False) -> dict:
    """Deprecated: ingest via gold_price_events.ingest_platform_gold_price instead."""
    from .gold_price_events import ingest_platform_gold_price
    from .spot_prices import resolve_cridora_base_22k_inr

    base, src = resolve_cridora_base_22k_inr()
    out = ingest_platform_gold_price(base=base, source=src)
    out["deprecated"] = True
    out["force_ignored"] = force
    return out
