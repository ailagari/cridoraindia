from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0027_vaultproductredemption_cross_redemption"),
    ]

    operations = [
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="image_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Optional HTTPS image shown in the push notification.",
                max_length=512,
            ),
        ),
    ]
