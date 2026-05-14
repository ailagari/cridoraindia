from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0012_goldticker_admin_markup_inr_per_gram"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="last_good_live_raw_snapshot_json",
            field=models.JSONField(
                blank=True,
                help_text="Last raw spot gold/silver ₹/g from feed (unadjusted); used when feed and caches are empty.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="live_metal_adjustments_json",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Per-metal deductions from live spot, e.g. {"gold":{"22K":{"mode":"percent","amount":"0.5"}}}.',
            ),
        ),
    ]
