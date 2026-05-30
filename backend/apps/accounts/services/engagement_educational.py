"""Educational market_awareness on gold ingest (event-driven, cache period gate)."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.cache import cache

from apps.accounts.models import PortfolioUserNotification
from apps.accounts.services.deliver_engagement import deliver_engagement
from apps.accounts.services.engagement_constants import CONTEXT_EDUCATIONAL, MOMENT_MARKET_AWARENESS
from apps.accounts.services.engagement_context import EngagementContextResult
from apps.marketplace.models import get_or_create_ticker

User = get_user_model()
_PERIOD_KEY = "engagement_edu_period"
_USER_KEY = "engagement_edu_u{uid}:{period}"


def _current_period() -> str:
    from django.utils import timezone

    now = timezone.now()
    return f"{now.year}-{now.month:02d}"


def maybe_send_educational_engagement(*, defer_push: bool = False) -> int:
    ticker = get_or_create_ticker()
    if not ticker.enable_educational_engagement:
        return 0
    period = _current_period()
    if cache.get(_PERIOD_KEY) != period:
        cache.set(_PERIOD_KEY, period, timeout=86400 * 40)

    sent = 0
    ctx = EngagementContextResult(
        context=CONTEXT_EDUCATIONAL,
        festival_name="",
        festival_message="",
    )
    for user in User.objects.filter(user_type=User.CUSTOMER, is_active=True).iterator(chunk_size=200):
        ukey = _USER_KEY.format(uid=user.pk, period=period)
        if cache.get(ukey):
            continue
        row = deliver_engagement(
            user,
            moment=MOMENT_MARKET_AWARENESS,
            context=ctx,
            link_path="/userdashboard?section=portfolio_overview",
            category=PortfolioUserNotification.CATEGORY_PROMO,
            priority=PortfolioUserNotification.PRIORITY_LOW,
            notification_type="market_educational",
            tag=f"edu-{period}-{user.pk}",
            defer_push=defer_push,
        )
        if row:
            cache.set(ukey, 1, timeout=86400 * 35)
            sent += 1
    return sent
