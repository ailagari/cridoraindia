from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0008_goldtickerconfig_manual_ticker"),
    ]

    operations = [
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="gold_rate_external_api_url",
            field=models.URLField(
                blank=True,
                max_length=512,
                help_text="Optional URL of your gold-rate feed for reference; not fetched automatically by Cridora yet.",
            ),
        ),
    ]
