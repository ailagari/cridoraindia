from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0027_gold_rate_daily_snapshot"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="portfolio_gain_threshold_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("500"),
                max_digits=14,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="portfolio_gain_threshold_percent",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("2"),
                max_digits=8,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="enable_fun_notifications",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="GoldRateHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("previous_rate", models.DecimalField(decimal_places=2, max_digits=12)),
                ("new_rate", models.DecimalField(decimal_places=2, max_digits=12)),
                ("difference", models.DecimalField(decimal_places=2, max_digits=12)),
                ("difference_percentage", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=8)),
                ("effective_from", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "jeweller",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="gold_rate_history",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
