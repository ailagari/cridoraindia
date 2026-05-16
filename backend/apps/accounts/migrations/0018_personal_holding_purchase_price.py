# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0017_personal_holding_weight_validator"),
    ]

    operations = [
        migrations.AddField(
            model_name="personalgoldholding",
            name="purchase_price_inr_per_gram",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text="Optional: what you paid per gram (₹/g) — used for indicative gain vs reference mark.",
                max_digits=18,
                null=True,
            ),
        ),
    ]
