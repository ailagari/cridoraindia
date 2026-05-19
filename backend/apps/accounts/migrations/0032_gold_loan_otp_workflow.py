from django.db import migrations, models


def forwards_approved_to_awaiting_otp(apps, schema_editor):
    GoldLoanRequest = apps.get_model("accounts", "GoldLoanRequest")
    GoldLoanRequest.objects.filter(status="approved").update(status="accepted_awaiting_otp")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0031_gold_loan_request"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldloanrequest",
            name="payment_method",
            field=models.CharField(
                choices=[("cash", "Cash at counter")],
                default="cash",
                max_length=16,
            ),
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
                    ("cancelled", "Cancelled"),
                ],
                default="pending_jeweller",
                max_length=32,
            ),
        ),
        migrations.CreateModel(
            name="GoldLoanOtp",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code_hash", models.CharField(max_length=64)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("failed_attempts", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "loan",
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name="settlement_otp",
                        to="accounts.goldloanrequest",
                    ),
                ),
            ],
            options={
                "verbose_name": "Gold loan settlement OTP",
            },
        ),
        migrations.RunPython(forwards_approved_to_awaiting_otp, migrations.RunPython.noop),
    ]
