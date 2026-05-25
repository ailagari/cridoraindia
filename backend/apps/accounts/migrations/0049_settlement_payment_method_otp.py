from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0048_remove_vyapar_gateway_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformsettlementpayment",
            name="payment_method",
            field=models.CharField(
                choices=[("upi", "UPI"), ("otp", "OTP")],
                default="upi",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="PlatformSettlementOtp",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code_hash", models.CharField(max_length=64)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("failed_attempts", models.PositiveSmallIntegerField(default=0)),
                ("verified_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "payment",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="settlement_otp",
                        to="accounts.platformsettlementpayment",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
