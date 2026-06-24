"""Seed default Engagement Engine notification templates from legacy copy."""

from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.accounts.models import NotificationTemplate
from apps.accounts.services.engagement_constants import (
    CONTEXT_DEFAULT,
    CONTEXT_EDUCATIONAL,
    CONTEXT_FESTIVAL,
    MOMENT_HOLDING_APPRECIATION,
    MOMENT_HOLDING_MILESTONE,
    MOMENT_MARKET_AWARENESS,
    MOMENT_PORTFOLIO_GROWTH,
    MOMENT_PORTFOLIO_MILESTONE,
)
from apps.accounts.services.notification_copy import (
    format_gold_rate_standard,
    format_holding_gain,
    format_portfolio_gain,
)


def _upsert(
    *,
    name: str,
    category: str,
    context: str,
    locale: str,
    title: str,
    body: str,
    variables: list[str],
) -> str:
    row, created = NotificationTemplate.objects.update_or_create(
        category=category,
        context=context,
        locale=locale,
        defaults={
            "name": name,
            "title_template": title,
            "body_template": body,
            "variables": variables,
            "is_active": True,
        },
    )
    return "created" if created else "updated"


class Command(BaseCommand):
    help = "Seed engagement templates (moment + context + locale)."

    def handle(self, *args, **options):
        sample_prev = Decimal("6000")
        sample_new = Decimal("6100")
        gold_body_ml = format_gold_rate_standard(
            previous_rate=sample_prev, new_rate=sample_new, locale="ml"
        )

        rows = [
            (
                "Portfolio growth (EN)",
                MOMENT_PORTFOLIO_GROWTH,
                CONTEXT_DEFAULT,
                "en",
                "Your gold moved today",
                "Your gold portfolio gained an estimated {{portfolio_gain_amount}} in value. Your grams haven't changed — the market did.",
                ["portfolio_gain_amount", "portfolio_value", "first_name"],
            ),
            (
                "Portfolio growth (ML)",
                MOMENT_PORTFOLIO_GROWTH,
                CONTEXT_DEFAULT,
                "ml",
                "Portfolio value update",
                format_portfolio_gain(Decimal("2500"), locale="ml").replace("₹2,500", "{{portfolio_gain_amount}}"),
                ["portfolio_gain_amount"],
            ),
            (
                "Holding appreciation (EN)",
                MOMENT_HOLDING_APPRECIATION,
                CONTEXT_DEFAULT,
                "en",
                "Portfolio value update",
                (
                    "Your {{holding_name}} is now {{holding_gain_amount}} higher in estimated value "
                    "— now about {{holding_value}}."
                ),
                ["holding_name", "holding_gain_amount", "holding_value", "years_held"],
            ),
            (
                "Holding appreciation festival (EN)",
                MOMENT_HOLDING_APPRECIATION,
                CONTEXT_FESTIVAL,
                "en",
                "Portfolio value update",
                (
                    "This {{festival_name}}, your {{holding_name}} is worth {{holding_value}}. "
                    "{{festival_message}}"
                ),
                ["festival_name", "festival_message", "holding_name", "holding_value"],
            ),
            (
                "Market awareness (EN)",
                MOMENT_MARKET_AWARENESS,
                CONTEXT_DEFAULT,
                "en",
                "Gold rate alert",
                (
                    "Gold rate moved {{gold_change_percent}} — reference is now {{gold_price}}."
                ),
                ["gold_price", "gold_change_percent"],
            ),
            (
                "Market awareness (ML)",
                MOMENT_MARKET_AWARENESS,
                CONTEXT_DEFAULT,
                "ml",
                "Gold rate alert",
                gold_body_ml,
                ["gold_price", "gold_change_percent"],
            ),
            (
                "Market educational (EN)",
                MOMENT_MARKET_AWARENESS,
                CONTEXT_EDUCATIONAL,
                "en",
                "Did you know?",
                (
                    "Gold moved {{gold_change_percent}} recently. "
                    "Your portfolio gained {{portfolio_gain_month_inr}} this month ({{month_label}})."
                ),
                ["gold_change_percent", "portfolio_gain_month_inr", "month_label"],
            ),
            (
                "Portfolio milestone (EN)",
                MOMENT_PORTFOLIO_MILESTONE,
                CONTEXT_DEFAULT,
                "en",
                "A milestone in your gold record",
                "{{portfolio_value}} worth of gold — and it's all yours, all accounted for.",
                ["portfolio_value", "first_name"],
            ),
            (
                "Holding milestone (EN)",
                MOMENT_HOLDING_MILESTONE,
                CONTEXT_DEFAULT,
                "en",
                "A piece worth noting",
                "Your {{holding_name}} is now valued at {{holding_value}} — counted, and cared for.",
                ["holding_name", "holding_value", "purchase_date", "years_held"],
            ),
        ]
        n = 0
        for name, cat, ctx, loc, title, body, vars_ in rows:
            action = _upsert(
                name=name,
                category=cat,
                context=ctx,
                locale=loc,
                title=title,
                body=body,
                variables=vars_,
            )
            n += 1
            self.stdout.write(f"{action}: {cat}/{ctx}/{loc}")
        self.stdout.write(self.style.SUCCESS(f"Seeded {n} engagement templates."))
