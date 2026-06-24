"""Engagement Engine: template render, context, deliver."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.models import NotificationTemplate
from apps.accounts.services.engagement_constants import (
    CONTEXT_DEFAULT,
    CONTEXT_FESTIVAL,
    MOMENT_HOLDING_APPRECIATION,
    MOMENT_PORTFOLIO_GROWTH,
)
from apps.accounts.services.engagement_context import (
    EngagementContextResult,
    resolve_engagement_context,
)
from apps.accounts.services.engagement_facts import build_engagement_facts, facts_for_festival
from apps.accounts.services.engagement_template_render import preview_render, render_template

User = get_user_model()


class EngagementTemplateRenderTests(TestCase):
    def setUp(self):
        NotificationTemplate.objects.update_or_create(
            category=MOMENT_PORTFOLIO_GROWTH,
            context=CONTEXT_DEFAULT,
            locale="en",
            defaults={
                "name": "Test growth",
                "title_template": "Hi {{first_name}}",
                "body_template": "Gain {{portfolio_gain_amount}}",
                "variables": ["first_name", "portfolio_gain_amount"],
                "is_active": True,
            },
        )

    def test_render_substitutes_variables(self):
        out = render_template(
            moment=MOMENT_PORTFOLIO_GROWTH,
            context=CONTEXT_DEFAULT,
            facts={"first_name": "Ana", "portfolio_gain_amount": "₹1,000"},
            locale="en",
        )
        self.assertIsNotNone(out)
        assert out is not None
        self.assertEqual(out.title, "Hi Ana")
        self.assertIn("₹1,000", out.body)

    def test_unknown_var_left_unchanged(self):
        out = preview_render(
            title_template="Hello {{unknown_key}}",
            body_template="Body",
            facts={"first_name": "X"},
        )
        self.assertIn("{{unknown_key}}", out["title"])

    def test_festival_facts(self):
        ctx = EngagementContextResult(
            context=CONTEXT_FESTIVAL,
            festival_name="Vishu",
            festival_message="Happy Vishu",
        )
        facts = facts_for_festival(ctx)
        self.assertEqual(facts["festival_name"], "Vishu")


class EngagementContextTests(TestCase):
    def test_campaign_override(self):
        ctx = resolve_engagement_context(
            campaign_context="festival",
            campaign_festival_name="Onam",
        )
        self.assertEqual(ctx.context, "festival")
        self.assertEqual(ctx.festival_name, "Onam")
