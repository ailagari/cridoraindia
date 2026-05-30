"""Platform 22K rate move: public broadcast + customer inbox after threshold alert."""

from __future__ import annotations

import logging
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from apps.accounts.models import GoldDepositIntake, PersonalGoldHolding, PortfolioUserNotification
from apps.accounts.services.inbox_notify import notify_inbox
from apps.accounts.services.notification_copy import format_gold_rate_standard
from apps.accounts.services.notification_rate_limits import gold_alert_allowed, record_gold_alert
from apps.marketplace.gold_rate_alerts import maybe_notify_gold_rate_move
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
    title: str,
    link: str,
    image_url: str,
    body: str | None = None,
) -> int:
    """Inbox + tray for customers with holdings (preferences + daily cap)."""
    msg = body or format_gold_rate_standard(previous_rate=baseline, new_rate=current)
    sent = 0
    for user in _customers_with_holdings_qs().iterator(chunk_size=100):
        if not gold_alert_allowed(user.pk):
            continue
        notify_inbox(
            user,
            kind=PortfolioUserNotification.KIND_SYSTEM,
            title=title[:120],
            body=msg,
            link_path=link,
            category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
            priority=PortfolioUserNotification.PRIORITY_MEDIUM,
            notification_type="gold_rate",
            image_url=image_url or None,
            tag="cridora-gold-rate-inbox",
        )
        record_gold_alert(user.pk)
        sent += 1
    return sent


def run_platform_gold_rate_notifications(*, force: bool = False) -> dict:
    """
    Run threshold broadcast (existing) then customer inbox + holding gain hooks.
    """
    result = maybe_notify_gold_rate_move(force=force)
    if not result.get("sent"):
        return result

    current = Decimal(str(result.get("current_inr") or "0"))
    if result.get("baseline_inr"):
        baseline = Decimal(str(result["baseline_inr"]))
    else:
        delta = Decimal(str(result.get("delta_inr") or "0"))
        baseline = (current - delta).quantize(Decimal("0.01"))
    if baseline <= 0 or current <= 0:
        return result

    from apps.marketplace.models import get_or_create_ticker

    ticker = get_or_create_ticker()
    title = (ticker.rate_move_alert_title or "Gold rate alert").strip() or "Gold rate alert"
    link = (ticker.rate_move_alert_link or "/marketplace").strip() or "/marketplace"
    image_url = (ticker.gold_push_image_url or "").strip()

    try:
        record_platform_gold_rate_history(previous_rate=baseline, new_rate=current)
    except Exception:
        logger.exception("platform GoldRateHistory insert failed")

    try:
        result["customer_inbox_sent"] = notify_customers_platform_gold_move(
            baseline=baseline,
            current=current,
            title=title,
            link=link,
            image_url=image_url,
        )
    except Exception:
        logger.exception("platform gold customer inbox failed")
        result["customer_inbox_sent"] = 0

    try:
        from apps.accounts.services.personal_holding_gain_notify import (
            notify_personal_holdings_after_rate_change,
        )

        result["holding_alerts_sent"] = notify_personal_holdings_after_rate_change(
            jeweller_id=None,
        )
    except Exception:
        logger.exception("holding gain after platform rate failed")
        result["holding_alerts_sent"] = 0

    return result
