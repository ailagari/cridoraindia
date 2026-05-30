"""Resolve active engagement template context and festival metadata."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.services.engagement_constants import (
    CONTEXT_DEFAULT,
    CONTEXT_FESTIVAL,
    CONTEXT_JEWELLER_CAMPAIGN,
)

User = get_user_model()


@dataclass(frozen=True)
class EngagementContextResult:
    context: str
    festival_name: str
    festival_message: str


def _ticker_in_context_window(now: datetime) -> bool:
    from apps.marketplace.models import get_or_create_ticker

    ticker = get_or_create_ticker()
    start = getattr(ticker, "engagement_context_starts_at", None)
    end = getattr(ticker, "engagement_context_ends_at", None)
    if start and now < start:
        return False
    if end and now > end:
        return False
    return True


def resolve_engagement_context(
    user: User | None = None,
    *,
    campaign_context: str | None = None,
    campaign_festival_name: str | None = None,
    campaign_festival_message: str | None = None,
) -> EngagementContextResult:
    if campaign_context and campaign_context.strip():
        ctx = campaign_context.strip()[:32]
        return EngagementContextResult(
            context=ctx,
            festival_name=(campaign_festival_name or "").strip()[:120],
            festival_message=(campaign_festival_message or "").strip()[:500],
        )

    from apps.marketplace.models import get_or_create_ticker

    ticker = get_or_create_ticker()
    now = timezone.now()
    active = (getattr(ticker, "active_engagement_context", None) or "").strip() or CONTEXT_DEFAULT
    if active != CONTEXT_DEFAULT and not _ticker_in_context_window(now):
        active = CONTEXT_DEFAULT

    festival_name = ""
    festival_message = ""
    if active == CONTEXT_FESTIVAL:
        festival_name = (getattr(ticker, "active_festival_name", None) or "").strip()[:120]
        festival_message = (getattr(ticker, "active_festival_message", None) or "").strip()[:500]

    if active not in (CONTEXT_DEFAULT, CONTEXT_FESTIVAL, CONTEXT_JEWELLER_CAMPAIGN, "educational"):
        active = CONTEXT_DEFAULT

    return EngagementContextResult(
        context=active,
        festival_name=festival_name,
        festival_message=festival_message,
    )
