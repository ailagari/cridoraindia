from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0003_mvp_storefront_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="marketplaceproduct",
            name="making_charge_mode",
            field=models.CharField(
                choices=[
                    ("fixed_per_gram", "Fixed per gram"),
                    ("percent_of_metal", "Percent of gold metal value"),
                ],
                default="fixed_per_gram",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="marketplaceproduct",
            name="making_charge_percent",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text="When mode is percent of metal, e.g. 8.5 for 8.5%.",
                max_digits=8,
                null=True,
            ),
        ),
    ]
