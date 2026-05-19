from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0024_jewellerpricingprofile_upi_vpa"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="gold_loan_ltv_min_percent",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("95"),
                help_text="Minimum loan-to-value (%) jewellers may offer against custodied vault gold.",
                max_digits=8,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="gold_loan_ltv_max_percent",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("99"),
                help_text="Maximum loan-to-value (%) jewellers may offer against custodied vault gold.",
                max_digits=8,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="gold_loan_processing_fee_jeweller_share_percent",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("0"),
                help_text="Share of processing fee (%) paid to jeweller on disbursement; remainder is Cridora revenue.",
                max_digits=8,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="gold_loan_ltv_percent",
            field=models.DecimalField(
                blank=True,
                decimal_places=3,
                help_text="Loan-to-value (%) of vault collateral this jeweller offers; must be within platform min–max.",
                max_digits=8,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="goldtickerconfig",
            name="gold_loan_processing_fee_percent",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("2"),
                help_text="Platform-disclosed gold loan processing fee (% of loan principal).",
                max_digits=8,
            ),
        ),
        migrations.AlterField(
            model_name="jewellerpricingprofile",
            name="gold_loan_jeweller_deduction_inr_per_gram",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Legacy disclosure — prefer gold_loan_ltv_percent for max loan % of collateral.",
                max_digits=12,
            ),
        ),
    ]
