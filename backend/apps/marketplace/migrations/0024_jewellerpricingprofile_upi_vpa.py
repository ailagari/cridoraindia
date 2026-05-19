from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0023_gold_push_alert_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="upi_vpa",
            field=models.CharField(
                blank=True,
                help_text="Jeweller UPI ID (VPA) for online fractional payments, e.g. shop@okicici.",
                max_length=128,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="upi_display_name",
            field=models.CharField(
                blank=True,
                help_text="Payee name shown on UPI apps (optional; defaults to business name).",
                max_length=80,
            ),
        ),
    ]
