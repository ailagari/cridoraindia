from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0029_fractional_upi_utr"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="payout_upi_vpa",
            field=models.CharField(
                blank=True,
                help_text="Customer UPI ID for sellback cash payouts.",
                max_length=128,
            ),
        ),
        migrations.AddField(
            model_name="goldsellbackrequest",
            name="payment_method",
            field=models.CharField(
                choices=[("cash", "Cash at counter"), ("upi", "UPI")],
                default="cash",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="goldsellbackrequest",
            name="payout_upi_vpa",
            field=models.CharField(
                blank=True,
                help_text="Snapshot of customer UPI VPA for online payout.",
                max_length=128,
            ),
        ),
        migrations.AddField(
            model_name="goldsellbackrequest",
            name="payment_note",
            field=models.CharField(
                blank=True,
                help_text="UPI transaction note, e.g. Cridora SB-42.",
                max_length=128,
            ),
        ),
        migrations.AddField(
            model_name="goldsellbackrequest",
            name="payout_expires_at",
            field=models.DateTimeField(
                blank=True,
                help_text="When an unfunded UPI payout should expire.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="goldsellbackrequest",
            name="upi_utr",
            field=models.CharField(
                blank=True,
                help_text="Jeweller-submitted UPI reference after paying customer.",
                max_length=32,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="goldsellbackrequest",
            name="utr_submitted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="goldsellbackrequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending_jeweller", "Pending jeweller"),
                    ("rejected", "Rejected"),
                    ("accepted_awaiting_otp", "Accepted awaiting OTP"),
                    ("awaiting_utr_verify", "Awaiting UTR verification"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                ],
                default="pending_jeweller",
                max_length=32,
            ),
        ),
    ]
