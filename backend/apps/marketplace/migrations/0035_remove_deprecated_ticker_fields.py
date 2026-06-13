from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0034_kerala_gold_rate_daily"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="goldtickerconfig",
            name="admin_markup_percent",
        ),
        migrations.RemoveField(
            model_name="goldtickerconfig",
            name="admin_markup_inr_per_gram",
        ),
        migrations.RemoveField(
            model_name="goldtickerconfig",
            name="enable_fun_notifications",
        ),
    ]
