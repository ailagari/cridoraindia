# Generated manually for gold rates ad video mode

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0038_gold_rates_ad_image_mode"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldratesadplacement",
            name="video_alt",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Accessible label for video banners.",
                max_length=160,
            ),
        ),
        migrations.AddField(
            model_name="goldratesadplacement",
            name="video_link_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Optional click-through URL for video banners.",
                max_length=512,
            ),
        ),
        migrations.AddField(
            model_name="goldratesadplacement",
            name="video_poster_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Optional poster image shown before the video plays.",
                max_length=512,
            ),
        ),
        migrations.AddField(
            model_name="goldratesadplacement",
            name="video_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Banner video URL when mode is Video (MP4 or WebM).",
                max_length=512,
            ),
        ),
        migrations.AlterField(
            model_name="goldratesadplacement",
            name="mode",
            field=models.CharField(
                choices=[
                    ("manual", "Manual HTML"),
                    ("image", "Image banner"),
                    ("video", "Video banner"),
                    ("adsense", "Google AdSense"),
                ],
                default="manual",
                max_length=16,
            ),
        ),
    ]
