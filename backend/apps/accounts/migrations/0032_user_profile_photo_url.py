from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0031_gold_loan_request"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="profile_photo_url",
            field=models.URLField(
                blank=True,
                help_text="Optional profile photo shown in dashboards and menus.",
                max_length=512,
            ),
        ),
    ]
