from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0016_alter_goldtickerconfig_admin_markup_inr_per_gram_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="hourly_gold_push_enabled",
            field=models.BooleanField(
                default=True,
                help_text="When on, hourly cron may broadcast Web Push comparing 22K reference vs prior hourly snapshot.",
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="hourly_gold_push_baseline_inr_per_gram_22k",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Last hourly snapshot of Cridora 22K ₹/g for digest pushes (internal).",
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="hourly_gold_push_baseline_recorded_at",
            field=models.DateTimeField(
                blank=True,
                help_text="When hourly snapshot baseline was recorded (internal).",
                null=True,
            ),
        ),
    ]
