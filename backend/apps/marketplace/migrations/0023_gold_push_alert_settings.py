from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0022_metal_purity_spot_keys_and_catalog_defaults"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="rate_move_alerts_enabled",
            field=models.BooleanField(
                default=True,
                help_text="When on, subscribers are notified when public 22K reference moves by ≥ threshold.",
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="hourly_gold_push_title",
            field=models.CharField(
                blank=True,
                default="Gold price update",
                help_text="Title for hourly 22K movement digest pushes.",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="hourly_gold_push_link",
            field=models.CharField(
                default="/marketplace",
                help_text="In-app path opened when the hourly digest is tapped.",
                max_length=512,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="rate_move_alert_title",
            field=models.CharField(
                blank=True,
                default="Gold rate alert",
                help_text="Title for threshold-based 22K reference move alerts.",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="rate_move_alert_link",
            field=models.CharField(
                default="/marketplace",
                help_text="In-app path opened when a threshold alert is tapped.",
                max_length=512,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="gold_push_image_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Optional image URL shown on automated gold price alerts (HTTPS recommended).",
                max_length=512,
            ),
        ),
        migrations.AlterField(
            model_name="goldtickerconfig",
            name="rate_move_alert_threshold_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("10.00"),
                help_text="Notify when public Cridora 22K reference moves by ≥ this ₹/g vs baseline (requires alerts enabled).",
                max_digits=12,
            ),
        ),
    ]
