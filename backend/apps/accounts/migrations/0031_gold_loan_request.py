from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0030_sellback_upi"),
    ]

    operations = [
        migrations.CreateModel(
            name="GoldLoanRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("grams", models.DecimalField(decimal_places=6, max_digits=16)),
                ("reference_metal_inr_per_gram_snapshot", models.DecimalField(decimal_places=2, max_digits=12)),
                ("collateral_value_inr_snapshot", models.DecimalField(decimal_places=2, max_digits=16)),
                ("ltv_percent_snapshot", models.DecimalField(decimal_places=3, max_digits=8)),
                (
                    "gross_principal_inr_snapshot",
                    models.DecimalField(
                        decimal_places=2,
                        help_text="Loan principal before processing fee (collateral × LTV%).",
                        max_digits=16,
                    ),
                ),
                ("processing_fee_percent_snapshot", models.DecimalField(decimal_places=3, max_digits=8)),
                ("processing_fee_inr_snapshot", models.DecimalField(decimal_places=2, max_digits=16)),
                (
                    "processing_fee_jeweller_share_inr_snapshot",
                    models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=16),
                ),
                (
                    "net_disbursement_inr_snapshot",
                    models.DecimalField(
                        decimal_places=2,
                        help_text="Cash to customer after processing fee deduction.",
                        max_digits=16,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending_jeweller", "Pending jeweller"),
                            ("rejected", "Rejected"),
                            ("approved", "Approved"),
                            ("disbursed", "Disbursed"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="pending_jeweller",
                        max_length=32,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "customer",
                    models.ForeignKey(
                        limit_choices_to={"user_type": "customer"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="gold_loans",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "jeweller",
                    models.ForeignKey(
                        limit_choices_to={"user_type": "jeweller"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="gold_loans_as_jeweller",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at", "-created_at"],
            },
        ),
    ]
