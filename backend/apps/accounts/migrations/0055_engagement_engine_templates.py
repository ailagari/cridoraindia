# Generated manually for Engagement Engine

from decimal import Decimal
from django.db import migrations, models


def _normalize_templates_before_unique(apps, schema_editor):
    NotificationTemplate = apps.get_model("accounts", "NotificationTemplate")
    for row in NotificationTemplate.objects.all():
        cat = (row.category or "promo").strip()
        if cat in ("promo", ""):
            row.category = f"legacy_{row.pk}"
        if len(row.category) > 32:
            row.category = row.category[:32]
        row.context = getattr(row, "context", None) or "default"
        row.locale = getattr(row, "locale", None) or "en"
        row.save(update_fields=["category", "context", "locale"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0054_notification_states_and_gold_ticker_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="engagement_context",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Engagement template context, e.g. festival, jeweller_campaign.",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="engagement_moment",
            field=models.CharField(
                blank=True,
                default="",
                help_text="When set with personalize_per_user, render this moment template per recipient.",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="festival_name",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Festival label for {{festival_name}} when context is festival.",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="festival_message",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="personalize_per_user",
            field=models.BooleanField(
                default=False,
                help_text="Render engagement template per audience member using their facts.",
            ),
        ),
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="store_in_inbox",
            field=models.BooleanField(
                default=False,
                help_text="Also create PortfolioUserNotification rows for recipients.",
            ),
        ),
        migrations.AddField(
            model_name="personalholdingnotificationstate",
            name="last_milestone_value_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Last holding value INR at which a holding_milestone alert fired.",
                max_digits=18,
            ),
        ),
        migrations.AddField(
            model_name="userportfolionotificationstate",
            name="last_milestone_portfolio_value_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Portfolio value INR when portfolio_milestone last fired.",
                max_digits=18,
            ),
        ),
        migrations.AddField(
            model_name="notificationtemplate",
            name="context",
            field=models.CharField(db_index=True, default="default", max_length=32),
        ),
        migrations.AddField(
            model_name="notificationtemplate",
            name="locale",
            field=models.CharField(db_index=True, default="en", max_length=8),
        ),
        migrations.AlterField(
            model_name="notificationtemplate",
            name="category",
            field=models.CharField(
                default="portfolio_growth",
                help_text="Engagement moment key, e.g. portfolio_growth, holding_appreciation.",
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="notificationtemplate",
            name="name",
            field=models.CharField(help_text="Admin display label.", max_length=120),
        ),
        migrations.AlterModelOptions(
            name="notificationtemplate",
            options={"ordering": ["category", "context", "locale"]},
        ),
        migrations.RunPython(_normalize_templates_before_unique, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="notificationtemplate",
            constraint=models.UniqueConstraint(
                fields=("category", "context", "locale"),
                name="uniq_notification_template_moment_ctx_locale",
            ),
        ),
    ]
