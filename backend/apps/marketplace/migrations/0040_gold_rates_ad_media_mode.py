# Generated manually — unified image & video banner mode

from django.db import migrations, models


def migrate_banner_modes(apps, schema_editor):
    Placement = apps.get_model("marketplace", "GoldRatesAdPlacement")
    Placement.objects.filter(mode__in=["image", "video"]).update(mode="media")


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0039_gold_rates_ad_video_mode"),
    ]

    operations = [
        migrations.AlterField(
            model_name="goldratesadplacement",
            name="mode",
            field=models.CharField(
                choices=[
                    ("manual", "Manual HTML"),
                    ("image", "Image banner"),
                    ("video", "Video banner"),
                    ("media", "Image & video banner"),
                    ("adsense", "Google AdSense"),
                ],
                default="manual",
                max_length=16,
            ),
        ),
        migrations.RunPython(migrate_banner_modes, migrations.RunPython.noop),
    ]
