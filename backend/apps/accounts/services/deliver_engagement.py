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
    format_holding_value_down,
    format_personal_collection_change,
    format_portfolio_gain,
    format_portfolio_value_change,
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
    if moment == "market_rate_increase" and previous_rate is not None and new_rate is not None:
        body = format_gold_rate_standard(
            previous_rate=previous_rate, new_rate=new_rate, locale=loc
        )
        return "Gold rate rose", body
    if moment == "market_rate_decrease" and previous_rate is not None and new_rate is not None:
        body = format_gold_rate_standard(
            previous_rate=previous_rate, new_rate=new_rate, locale=loc
        )
        return "Gold rate eased", body
    if moment == "portfolio_value_up":
        try:
            change = Decimal((facts.get("value_change_amount") or "0").replace(",", ""))
            total = Decimal((facts.get("portfolio_value") or "0").replace("₹", "").replace(",", ""))
        except Exception:
            change, total = Decimal("0"), Decimal("0")
        body = format_portfolio_value_change(
            change_inr=change, total_inr=total, direction="up", locale=loc, first_name=facts.get("first_name", "")
        )
        return "Your gold grew today", body
    if moment == "portfolio_value_down":
        try:
            change = Decimal((facts.get("value_change_amount") or "0").replace(",", ""))
            weight = facts.get("portfolio_weight", "")
        except Exception:
            change, weight = Decimal("0"), ""
        body = format_portfolio_value_change(
            change_inr=change, total_inr=Decimal("0"), direction="down", locale=loc, weight=weight
        )
        return "Gold market moved", body
    if moment == "personal_collection_growth":
        try:
            change = Decimal((facts.get("personal_collection_gain") or "0").replace(",", ""))
            total = Decimal((facts.get("personal_collection_value") or "0").replace(",", ""))
        except Exception:
            change, total = Decimal("0"), Decimal("0")
        body = format_personal_collection_change(
            change_inr=change, total_inr=total, direction="up", locale=loc
        )
        return "Your collection gained", body
    if moment == "personal_collection_down":
        try:
            change = Decimal((facts.get("personal_collection_loss") or "0").replace(",", ""))
        except Exception:
            change = Decimal("0")
        body = format_personal_collection_change(
            change_inr=change, total_inr=Decimal("0"), direction="down", locale=loc
        )
        return "Collection estimate shifted", body
    if moment == "holding_value_down":
        name = facts.get("holding_name", "Your item")
        try:
            loss = Decimal(
                (facts.get("holding_loss_amount") or "0").replace("₹", "").replace(",", "")
            )
            val = Decimal((facts.get("holding_value") or "0").replace("₹", "").replace(",", ""))
        except Exception:
            loss, val = Decimal("0"), Decimal("0")
        body = format_holding_value_down(title=name, loss_inr=loss, new_value_inr=val, locale=loc)
        return "Market moved — holding update", body
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

    if locale is None:
        from apps.accounts.services.notification_locale import resolve_user_notification_locale

        loc = resolve_user_notification_locale(user)
    else:
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
