"""Build fact dictionaries for Engagement Engine template rendering."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.locale_utils import DEFAULT_PUBLIC_LOCALE, normalize_preferred_locale
from apps.accounts.models import PersonalGoldHolding
from apps.accounts.services.engagement_context import (
    EngagementContextResult,
    resolve_engagement_context,
)
from apps.accounts.services.personal_holdings import (
    calculate_holding_value_inr,
    customer_portfolio_totals_payload,
)

User = get_user_model()


def _fmt_inr(value: Decimal | int | float, *, locale: str) -> str:
    q = Decimal(str(value)).quantize(Decimal("0.01"))
    loc = normalize_preferred_locale(locale)
    if loc == "ml":
        return f"₹{q:,.0f}"
    return f"₹{q:,.2f}" if q % 1 else f"₹{q:,.0f}"


def _fmt_pct(value: Decimal, *, locale: str) -> str:
    q = value.quantize(Decimal("0.01"))
    return f"{q}%"


def _holding_tenure(purchase_date: date | None, created_at) -> tuple[str, str]:
    ref = purchase_date
    if ref is None and created_at:
        ref = timezone.localdate(created_at)
    if ref is None:
        return "", ""
    today = timezone.localdate()
    days = max(0, (today - ref).days)
    years = days // 365
    if years >= 1:
        label = "1 year" if years == 1 else f"{years} years"
    elif days >= 30:
        months = days // 30
        label = "1 month" if months == 1 else f"{months} months"
    else:
        label = "1 day" if days == 1 else f"{days} days"
    return str(days), label


def facts_for_user(user: User, *, locale: str = DEFAULT_PUBLIC_LOCALE) -> dict[str, str]:
    first = (user.first_name or "").strip() or "there"
    city = ""
    if hasattr(user, "city") and user.city:
        city = str(user.city).strip()
    joined = user.date_joined
    member_since = joined.strftime("%B %Y") if joined else ""
    return {
        "first_name": first,
        "city": city,
        "member_since": member_since,
    }


def facts_for_portfolio(user: User, *, locale: str = DEFAULT_PUBLIC_LOCALE) -> dict[str, str]:
    totals = customer_portfolio_totals_payload(user)
    value = Decimal(str(totals.get("total_estimated_value_inr") or "0"))
    gain_inr = Decimal(str(totals.get("personal_gain_on_recorded_cost_inr") or "0"))
    gain_pct = Decimal(str(totals.get("personal_gain_on_recorded_cost_percent") or "0"))
    grams = Decimal(str(totals.get("total_gold_grams") or "0"))
    return {
        "portfolio_value": _fmt_inr(value, locale=locale),
        "portfolio_gain_amount": _fmt_inr(gain_inr, locale=locale),
        "portfolio_gain_percent": _fmt_pct(gain_pct, locale=locale),
        "portfolio_weight": f"{grams.quantize(Decimal('0.001'))} g",
    }


def facts_for_holding(
    holding: PersonalGoldHolding,
    *,
    gain_inr: Decimal | None = None,
    value_inr: Decimal | None = None,
    locale: str = DEFAULT_PUBLIC_LOCALE,
) -> dict[str, str]:
    rate_val = value_inr
    if rate_val is None:
        from apps.marketplace.spot_prices import reference_gold_rate_inr_per_gram

        rate, _ = reference_gold_rate_inr_per_gram()
        rate_val = calculate_holding_value_inr(holding.weight_grams, rate)
    rate_val = rate_val.quantize(Decimal("0.01"))
    baseline = holding.estimated_current_value_inr or rate_val
    gain = gain_inr
    if gain is None:
        gain = (rate_val - baseline).quantize(Decimal("0.01"))
    gain_pct = Decimal("0")
    if holding.purchase_price_inr_per_gram and holding.purchase_price_inr_per_gram > 0:
        cost = (holding.weight_grams * holding.purchase_price_inr_per_gram).quantize(Decimal("0.01"))
        if cost > 0:
            gain_pct = ((rate_val - cost) / cost * Decimal("100")).quantize(Decimal("0.01"))

    age_days, years_held = _holding_tenure(holding.purchase_date, holding.created_at)
    purchase_fmt = ""
    if holding.purchase_date:
        purchase_fmt = holding.purchase_date.strftime("%d %b %Y")

    return {
        "holding_name": (holding.title or "Your item").strip(),
        "holding_category": holding.category or "",
        "holding_value": _fmt_inr(rate_val, locale=locale),
        "holding_gain_amount": _fmt_inr(max(gain, Decimal("0")), locale=locale),
        "holding_gain_percent": _fmt_pct(gain_pct, locale=locale),
        "holding_loss_amount": _fmt_inr(abs(min(gain, Decimal("0"))), locale=locale),
        "purchase_date": purchase_fmt,
        "holding_age_days": age_days,
        "years_held": years_held,
    }


def facts_for_market(
    *,
    previous_rate: Decimal | None = None,
    new_rate: Decimal | None = None,
    change_percent: Decimal | None = None,
    monthly_change: str = "",
    locale: str = DEFAULT_PUBLIC_LOCALE,
) -> dict[str, str]:
    from apps.marketplace.spot_prices import reference_gold_rate_inr_per_gram

    current = new_rate
    if current is None:
        current, _ = reference_gold_rate_inr_per_gram()
    current = current.quantize(Decimal("0.01"))
    pct = change_percent
    if pct is None and previous_rate and previous_rate > 0:
        pct = ((current - previous_rate) / previous_rate * Decimal("100")).quantize(Decimal("0.01"))
    if pct is None:
        pct = Decimal("0")
    return {
        "gold_price": _fmt_inr(current, locale=locale) + "/g",
        "gold_change_percent": _fmt_pct(pct, locale=locale),
        "monthly_change": monthly_change,
    }


def facts_for_festival(ctx: EngagementContextResult) -> dict[str, str]:
    return {
        "festival_name": ctx.festival_name,
        "festival_message": ctx.festival_message,
    }


def facts_for_jeweller(jeweller_id: int | None, *, locale: str = DEFAULT_PUBLIC_LOCALE) -> dict[str, str]:
    from apps.accounts.services.notification_copy import resolve_jeweller_push_branding

    if not jeweller_id:
        return {"jeweller_name": "", "offer_name": "", "offer_end_date": ""}
    branding = resolve_jeweller_push_branding(jeweller_id)
    return {
        "jeweller_name": branding.get("title_prefix") or "",
        "offer_name": "",
        "offer_end_date": "",
    }


def merge_facts(*parts: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for p in parts:
        out.update({k: str(v) for k, v in p.items() if v is not None})
    return out


def build_engagement_facts(
    user: User,
    *,
    locale: str = DEFAULT_PUBLIC_LOCALE,
    context: EngagementContextResult | None = None,
    holding: PersonalGoldHolding | None = None,
    gain_inr: Decimal | None = None,
    value_inr: Decimal | None = None,
    previous_rate: Decimal | None = None,
    new_rate: Decimal | None = None,
    change_percent: Decimal | None = None,
    jeweller_id: int | None = None,
    extra: dict[str, str] | None = None,
) -> dict[str, str]:
    ctx = context or resolve_engagement_context(user)
    parts = [
        facts_for_user(user, locale=locale),
        facts_for_portfolio(user, locale=locale),
        facts_for_festival(ctx),
        facts_for_jeweller(jeweller_id or (holding.jeweller_id if holding else None), locale=locale),
    ]
    monthly = build_monthly_storytelling_facts(user, locale=locale)
    parts.append(monthly)
    if holding:
        parts.append(
            facts_for_holding(
                holding,
                gain_inr=gain_inr,
                value_inr=value_inr,
                locale=locale,
            )
        )
    if previous_rate is not None or new_rate is not None:
        parts.append(
            facts_for_market(
                previous_rate=previous_rate,
                new_rate=new_rate,
                change_percent=change_percent,
                monthly_change=monthly.get("gold_change_month_percent", ""),
                locale=locale,
            )
        )
    if extra:
        parts.append(extra)
    return merge_facts(*parts)


def build_monthly_storytelling_facts(user: User, *, locale: str = DEFAULT_PUBLIC_LOCALE) -> dict[str, str]:
    """Compute monthly aggregates for preview / future digest (send deferred)."""
    now = timezone.localdate()
    month_label = now.strftime("%B %Y")
    totals = customer_portfolio_totals_payload(user)
    gain_inr = totals.get("personal_gain_on_recorded_cost_inr") or "0"
    gain_pct = totals.get("personal_gain_on_recorded_cost_percent") or "0"

    gold_month_pct = ""
    try:
        from apps.marketplace.models import GoldRateHistory

        month_start = now.replace(day=1)
        rows = GoldRateHistory.objects.filter(
            jeweller__isnull=True,
            effective_from__date__gte=month_start,
        ).order_by("effective_from")
        first = rows.first()
        last = rows.order_by("-effective_from").first()
        if first and last and first.new_rate > 0:
            delta = ((last.new_rate - first.new_rate) / first.new_rate * Decimal("100")).quantize(
                Decimal("0.01")
            )
            gold_month_pct = _fmt_pct(delta, locale=locale)
    except Exception:
        gold_month_pct = ""

    best_name = ""
    best_gain = Decimal("0")
    for h in PersonalGoldHolding.objects.filter(user=user, is_removed=False).iterator():
        val = h.estimated_current_value_inr or Decimal("0")
        if h.purchase_price_inr_per_gram and h.purchase_price_inr_per_gram > 0:
            cost = (h.weight_grams * h.purchase_price_inr_per_gram).quantize(Decimal("0.01"))
            g = (val - cost).quantize(Decimal("0.01"))
            if g > best_gain:
                best_gain = g
                best_name = h.title

    return {
        "month_label": month_label,
        "portfolio_gain_month_inr": _fmt_inr(Decimal(str(gain_inr or "0")), locale=locale),
        "portfolio_gain_month_percent": _fmt_pct(Decimal(str(gain_pct or "0")), locale=locale),
        "holding_gain_month_inr": _fmt_inr(best_gain, locale=locale) if best_gain > 0 else "",
        "gold_change_month_percent": gold_month_pct,
        "best_performing_holding_name": best_name,
        "monthly_change": gold_month_pct,
    }
