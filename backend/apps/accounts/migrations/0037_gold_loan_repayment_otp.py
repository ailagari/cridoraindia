from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0036_jeweller_revenue_ledger"),
    ]

    operations = [
        migrations.CreateModel(
            name="GoldLoanRepaymentRequest",
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
                    "status",
                    models.CharField(
                        choices=[
                            ("pending_jeweller", "Pending jeweller"),
                            ("rejected", "Rejected"),
                            ("accepted_awaiting_otp", "Accepted awaiting OTP"),
                            ("completed", "Completed"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="pending_jeweller",
                        max_length=32,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "loan",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="repayment_requests",
                        to="accounts.goldloanrequest",
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="GoldLoanRepaymentOtp",
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
                ("code_hash", models.CharField(max_length=64)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("failed_attempts", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "repayment_request",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="settlement_otp",
                        to="accounts.goldloanrepaymentrequest",
                    ),
                ),
            ],
            options={
                "verbose_name": "Gold loan repayment OTP",
            },
        ),
    ]
