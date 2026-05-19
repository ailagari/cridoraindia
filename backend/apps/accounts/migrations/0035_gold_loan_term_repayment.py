from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0034_merge_loan_otp_and_profile"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldloanrequest",
            name="term_months",
            field=models.PositiveSmallIntegerField(
                default=12,
                help_text="Loan tenure in months (1–platform max, typically 12).",
            ),
        ),
        migrations.AddField(
            model_name="goldloanrequest",
            name="collateral_fractional_grams",
            field=models.DecimalField(
                decimal_places=6,
                default=Decimal("0"),
                max_digits=16,
            ),
        ),
        migrations.AddField(
            model_name="goldloanrequest",
            name="collateral_deposit_grams",
            field=models.DecimalField(
                decimal_places=6,
                default=Decimal("0"),
                max_digits=16,
            ),
        ),
        migrations.AddField(
            model_name="goldloanrequest",
            name="principal_paid_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Cumulative principal repaid in INR.",
                max_digits=16,
            ),
        ),
        migrations.AddField(
            model_name="goldloanrequest",
            name="disbursed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="goldloanrequest",
            name="due_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="goldloanrequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending_jeweller", "Pending jeweller"),
                    ("rejected", "Rejected"),
                    ("accepted_awaiting_otp", "Accepted awaiting OTP"),
                    ("disbursed", "Disbursed"),
                    ("repaid", "Repaid"),
                    ("cancelled", "Cancelled"),
                ],
                default="pending_jeweller",
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="vaultholding",
            name="holding_type",
            field=models.CharField(
                choices=[
                    ("fractional", "Fractional gold"),
                    ("deposit", "Gold deposit"),
                    ("golden_scheme", "Golden scheme"),
                    ("loan_collateral", "Loan collateral (locked)"),
                ],
                default="fractional",
                max_length=24,
            ),
        ),
        migrations.CreateModel(
            name="GoldLoanRepayment",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("amount_inr", models.DecimalField(decimal_places=2, max_digits=16)),
                (
                    "principal_after_inr",
                    models.DecimalField(
                        decimal_places=2,
                        help_text="Principal outstanding immediately after this payment.",
                        max_digits=16,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "loan",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="repayments",
                        to="accounts.goldloanrequest",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
