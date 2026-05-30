# Generated manually for Engagement Engine

from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0030_notification_states_and_gold_ticker_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="active_engagement_context",
            field=models.CharField(
                blank=True,
                default="default",
                help_text="Platform-wide template context for ingest-driven engagement.",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="active_festival_message",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="active_festival_name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="engagement_context_ends_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="engagement_context_starts_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="enable_educational_engagement",
            field=models.BooleanField(
                default=False,
                help_text="On gold ingest, allow one educational market_awareness message per user per period.",
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="enable_monthly_storytelling_push",
            field=models.BooleanField(
                default=False,
                help_text="When on, future monthly digest pushes may send (facts always computed in v1).",
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="holding_milestone_threshold_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("100000"),
                help_text="Notify when a holding estimated value crosses this INR (once per band).",
                max_digits=14,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="max_portfolio_alerts_per_day",
            field=models.PositiveSmallIntegerField(
                default=2,
                help_text="Max portfolio_growth / portfolio_milestone alerts per customer per day.",
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="portfolio_milestone_thresholds_inr",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='List of INR thresholds, e.g. ["100000","500000"].',
            ),
        ),
        migrations.AlterField(
            model_name="goldtickerconfig",
            name="enable_fun_notifications",
            field=models.BooleanField(
                default=False,
                help_text="Deprecated: use enable_educational_engagement on ingest.",
            ),
        ),
    ]
