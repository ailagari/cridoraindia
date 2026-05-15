from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0013_live_metal_ticker_adjustments"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="gold_loan_processing_fee_percent",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("0"),
                help_text="Platform-disclosed gold loan processing fee (% of loan principal).",
                max_digits=8,
            ),
        ),
        migrations.RemoveField(
            model_name="goldtickerconfig",
            name="gold_loan_processing_fee_inr",
        ),
    ]
