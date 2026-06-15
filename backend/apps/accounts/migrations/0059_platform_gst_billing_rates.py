from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0058_personal_holding_making_charge_percent"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformoperationalsettings",
            name="gst_on_gold_percent",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("3"),
                help_text="GST % on gold metal value (ornament billing, fractional buy, schemes).",
                max_digits=6,
                validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
            ),
        ),
        migrations.AddField(
            model_name="platformoperationalsettings",
            name="gst_on_making_percent",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("18"),
                help_text="GST % on jewellery making charges.",
                max_digits=6,
                validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
            ),
        ),
    ]
