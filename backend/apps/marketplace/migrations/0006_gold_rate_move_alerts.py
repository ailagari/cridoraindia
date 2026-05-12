from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0005_jeweller_gold_rate_source"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="rate_move_alert_threshold_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("10.00"),
                help_text="Push to subscribers when resolved 22K ₹/g moves by ≥ this vs last alert. Use 0 to disable.",
                max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="rate_alert_baseline_inr_per_gram_22k",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Last resolved 22K rate at which alerts were checked (internal).",
                max_digits=12,
                null=True,
            ),
        ),
    ]
