from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0040_gold_rates_ad_media_mode"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="ticker_manual_18k_inr_per_gram",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Optional manual 18K ₹/g; if empty, 18K is derived from 24K × 0.75.",
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="ticker_manual_silver_999_inr_per_gram",
            field=models.DecimalField(
                blank=True,
                decimal_places=3,
                help_text="Optional manual silver 999 ₹/g; if set, 925 is derived as 999 × 0.925.",
                max_digits=12,
                null=True,
            ),
        ),
    ]
