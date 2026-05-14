from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0011_metal_pricing_and_platform_loan_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="admin_markup_inr_per_gram",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Added after percent on raw live spot 22K (final Cridora reference for jewellers).",
                max_digits=12,
            ),
        ),
        migrations.AlterField(
            model_name="goldtickerconfig",
            name="admin_markup_percent",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("0"),
                help_text="Percent markup on raw live spot 22K before fixed ₹/g add-on.",
                max_digits=8,
            ),
        ),
        migrations.AlterField(
            model_name="goldtickerconfig",
            name="reference_price_inr_per_gram_22k",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("7245.50"),
                help_text="Emergency raw 22K ₹/g when spot feed and caches are empty; same % and ₹/g adjustments apply.",
                max_digits=12,
            ),
        ),
        migrations.AlterField(
            model_name="goldtickerconfig",
            name="rate_move_alert_threshold_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("10.00"),
                help_text="Notify subscribers when Cridora reference 22K ₹/g moves by ≥ this vs previous reference. 0 disables.",
                max_digits=12,
            ),
        ),
        migrations.AlterField(
            model_name="goldtickerconfig",
            name="rate_alert_baseline_inr_per_gram_22k",
            field=models.DecimalField(
                blank=True,
                help_text="Previous Cridora reference 22K ₹/g used for alert comparisons (internal).",
                null=True,
                decimal_places=2,
                max_digits=12,
            ),
        ),
    ]
