from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0014_gold_loan_processing_fee_percent"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="cross_platform_fee_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("49.00"),
                help_text="Cridora cross-jeweller platform fee (₹) at checkout for X-redeem listings.",
                max_digits=12,
            ),
        ),
        migrations.AlterModelOptions(
            name="goldtickerconfig",
            options={"verbose_name": "Ticker and fees configuration"},
        ),
    ]
