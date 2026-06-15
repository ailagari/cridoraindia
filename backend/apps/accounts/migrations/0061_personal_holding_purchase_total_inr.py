from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0060_india_gst_on_making_default"),
    ]

    operations = [
        migrations.AddField(
            model_name="personalgoldholding",
            name="purchase_total_inr",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Optional: total bill amount the customer entered (₹) — preserved as entered.",
                max_digits=18,
                null=True,
            ),
        ),
    ]
