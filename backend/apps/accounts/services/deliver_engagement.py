"""Render engagement templates and deliver via existing notify_inbox."""

from __future__ import annotations

import logging
from decimal import Decimal

from django.contrib.auth import get_user_model

from apps.accounts.locale_utils import DEFAULT_PUBLIC_LOCALE, normalize_preferred_locale
from apps.accounts.models import PortfolioUserNotification
from apps.accounts.services.engagement_context import EngagementContextResult, resolve_engagement_context
from apps.accounts.services.engagement_facts import build_engagement_facts
from apps.accounts.services.engagement_template_render import render_template
from apps.accounts.services.notification_copy import (
    format_gold_rate_standard,
    format_holding_gain,
    format_portfolio_gain,
)

logger = logging.getLogger(__name__)
User = get_user_model()


def _fallback_copy(
    *,
    moment: str,
    locale: str,
    facts: dict[str, str],
    previous_rate: Decimal | None,
    new_rate: Decimal | None,
) -> tuple[str, str] | None:
    loc = normalize_preferred_locale(locale)
    if moment == "portfolio_growth":
        gain = facts.get("portfolio_gain_amount", "").replace("₹", "").replace(",", "")
        try:
            body = format_portfolio_gain(Decimal(gain or "0"), locale=loc)
        except Exception:
            body = format_portfolio_gain(Decimal("0"), locale=loc)
        return "Portfolio value update", body
    if moment == "holding_appreciation":
        name = facts.get("holding_name", "Your item")
        try:
            gain = Decimal(
                (facts.get("holding_gain_amount") or "0").replace("₹", "").replace(",", "")
            )
            val = Decimal((facts.get("holding_value") or "0").replace("₹", "").replace(",", ""))
        except Exception:
            gain, val = Decimal("0"), Decimal("0")
        body = format_holding_gain(title=name, gain_inr=gain, new_value_inr=val, locale=loc)
        return "Portfolio value update", body
    if moment == "market_awareness" and previous_rate is not None and new_rate is not None:
        body = format_gold_rate_standard(
            previous_rate=previous_rate, new_rate=new_rate, locale=loc
        )
        return "Gold rate alert", body
    return None


def deliver_engagement(
    user: User,
    *,
    moment: str,
    link_path: str = "/userdashboard?section=portfolio_overview",
    category: str = PortfolioUserNotification.CATEGORY_PORTFOLIO,
    priority: str = PortfolioUserNotification.PRIORITY_LOW,
    notification_type: str = "",
    kind: str = PortfolioUserNotification.KIND_SYSTEM,
    tag: str | None = None,
    jeweller_id: int | None = None,
    image_url: str | None = None,
    logo_url: str | None = None,
    title_override: str | None = None,
    defer_push: bool = False,
    locale: str | None = None,
    context: EngagementContextResult | None = None,
    holding=None,
    gain_inr: Decimal | None = None,
    value_inr: Decimal | None = None,
    previous_rate: Decimal | None = None,
    new_rate: Decimal | None = None,
    change_percent: Decimal | None = None,
    extra_facts: dict[str, str] | None = None,
    send_push: bool = True,
) -> PortfolioUserNotification | None:
    from apps.accounts.services.inbox_notify import notify_inbox

    loc = normalize_preferred_locale(locale or DEFAULT_PUBLIC_LOCALE)
    ctx = context or resolve_engagement_context(user)
    facts = build_engagement_facts(
        user,
        locale=loc,
        context=ctx,
        holding=holding,
        gain_inr=gain_inr,
        value_inr=value_inr,
        previous_rate=previous_rate,
        new_rate=new_rate,
        change_percent=change_percent,
        jeweller_id=jeweller_id,
        extra=extra_facts,
    )
    rendered = render_template(moment=moment, context=ctx.context, facts=facts, locale=loc)
    if rendered:
        title = title_override or rendered.title
        body = rendered.body
    else:
        fb = _fallback_copy(
            moment=moment,
            locale=loc,
            facts=facts,
            previous_rate=previous_rate,
            new_rate=new_rate,
        )
        if not fb:
            logger.warning("engagement_no_template moment=%s user=%s", moment, user.pk)
            return None
        title, body = fb
        if title_override:
            title = title_override

    if jeweller_id and not title_override:
        from apps.accounts.services.notification_copy import resolve_jeweller_push_branding

        branding = resolve_jeweller_push_branding(jeweller_id)
        prefix = branding.get("title_prefix") or ""
        if prefix and not title.startswith(prefix):
            title = f"{prefix}: {title}"[:180]

    ntype = notification_type or moment
    return notify_inbox(
        user,
        kind=kind,
        title=title[:180],
        body=body,
        link_path=link_path,
        category=category,
        priority=priority,
        notification_type=ntype,
        send_push=send_push,
        image_url=image_url,
        logo_url=logo_url,
        jeweller_id=jeweller_id,
        tag=tag or f"eng-{moment}-{user.pk}",
        defer_push=defer_push,
    )
