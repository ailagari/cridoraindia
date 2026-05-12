from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0004_product_making_charge_mode"),
    ]

    operations = [
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="gold_rate_source",
            field=models.CharField(
                choices=[
                    ("live_cridora", "Cridora live 22K (global spot)"),
                    ("manual", "Manual 22K rate"),
                ],
                default="live_cridora",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="manual_gold_rate_inr_per_gram",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Your fixed 22K ₹/g when gold_rate_source=manual.",
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="live_markup_percent",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("0"),
                help_text="Markup % applied on top of Cridora live 22K base.",
                max_digits=8,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="live_markup_inr_per_gram",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Additional ₹/g on top of Cridora live 22K after percent markup.",
                max_digits=12,
            ),
        ),
    ]
