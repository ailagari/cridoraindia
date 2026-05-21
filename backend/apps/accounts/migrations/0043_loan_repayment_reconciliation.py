import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0042_payment_reconciliation"),
    ]

    operations = [
        migrations.AddField(
            model_name="paymentsignal",
            name="loan_repayment",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="payment_signals",
                to="accounts.goldloanrepaymentrequest",
            ),
        ),
        migrations.AddField(
            model_name="paymentsignal",
            name="order_id_hint",
            field=models.CharField(
                blank=True,
                help_text="Unmatched SMS hint, e.g. CR-42 or LRP-7.",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="payment_method",
            field=models.CharField(
                choices=[("cash", "Cash"), ("upi", "UPI")],
                default="cash",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="payee_upi_vpa",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="payment_note",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="payment_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="upi_utr",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="utr_submitted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="reconciliation_score",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="reconciliation_flags",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="reconciled_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="payment_signal_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="confirmed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="loan_repayments_confirmed",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="goldloanrepaymentrequest",
            name="best_payment_signal",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="accounts.paymentsignal",
            ),
        ),
        migrations.AlterField(
            model_name="goldloanrepaymentrequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending_payment", "Pending UPI payment"),
                    ("signal_received", "Payment signal received"),
                    ("pending_jeweller", "Pending jeweller"),
                    ("pending_review", "Pending jeweller review"),
                    ("needs_manual_verification", "Needs manual verification"),
                    ("rejected", "Rejected"),
                    ("accepted_awaiting_otp", "Accepted awaiting OTP"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                ],
                default="pending_jeweller",
                max_length=32,
            ),
        ),
    ]
