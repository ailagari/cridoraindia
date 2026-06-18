from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0043_goldticker_per_metal_sources"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="hourly_gold_push_link_guest",
            field=models.CharField(
                blank=True,
                default="",
                help_text="In-app path for guests tapping the hourly digest (defaults to hourly_gold_push_link).",
                max_length=512,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="hourly_gold_push_link_authenticated",
            field=models.CharField(
                blank=True,
                default="",
                help_text="In-app path for signed-in users tapping the hourly digest (defaults to hourly_gold_push_link).",
                max_length=512,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="rate_move_alert_link_guest",
            field=models.CharField(
                blank=True,
                default="",
                help_text="In-app path for guests tapping a threshold alert (defaults to rate_move_alert_link).",
                max_length=512,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="rate_move_alert_link_authenticated",
            field=models.CharField(
                blank=True,
                default="",
                help_text="In-app path for signed-in users tapping a threshold alert (defaults to rate_move_alert_link).",
                max_length=512,
            ),
        ),
        migrations.AlterField(
            model_name="goldtickerconfig",
            name="hourly_gold_push_link",
            field=models.CharField(
                default="/marketplace",
                help_text="Fallback in-app path when hourly digest tap targets are not set.",
                max_length=512,
            ),
        ),
        migrations.AlterField(
            model_name="goldtickerconfig",
            name="rate_move_alert_link",
            field=models.CharField(
                default="/marketplace",
                help_text="Fallback in-app path when threshold alert tap targets are not set.",
                max_length=512,
            ),
        ),
    ]
