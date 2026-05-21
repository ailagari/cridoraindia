from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0040_platform_fractional_markup"),
    ]

    operations = [
        migrations.AddField(
            model_name="webpushsubscription",
            name="preferred_locale",
            field=models.CharField(blank=True, default="en", max_length=8),
        ),
        migrations.AddField(
            model_name="nativepushtoken",
            name="preferred_locale",
            field=models.CharField(blank=True, default="en", max_length=8),
        ),
    ]
