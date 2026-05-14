from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0007_alter_jewellerpricingprofile_live_markup_inr_per_gram_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="manual_ticker_enabled",
            field=models.BooleanField(
                default=False,
                help_text="When on, public ticker and platform 22K base use manual rates below (overrides live spot).",
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="ticker_manual_22k_inr_per_gram",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Manual BIS 916 / 22K ₹ per gram for the ticker when manual mode is on.",
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="ticker_manual_24k_inr_per_gram",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Optional manual 24K ₹/g; if empty, 24K is derived as 22K ÷ 0.916.",
                max_digits=12,
                null=True,
            ),
        ),
    ]
