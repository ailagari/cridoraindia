from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0025_gold_loan_ltv_policy"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="gold_loan_max_term_months",
            field=models.PositiveSmallIntegerField(
                default=12,
                help_text="Maximum gold loan tenure in months (customer-selectable up to this).",
            ),
        ),
    ]
