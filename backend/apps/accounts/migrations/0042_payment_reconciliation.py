# Generated for UPI reconciliation engine

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def migrate_awaiting_utr_to_pending_review(apps, schema_editor):
    FractionalGoldPurchase = apps.get_model("accounts", "FractionalGoldPurchase")
    FractionalGoldPurchase.objects.filter(status="awaiting_utr_verify").update(
        status="pending_review"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0041_push_preferred_locale"),
    ]

    operations = [
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="reconciliation_score",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="reconciliation_flags",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="reconciled_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="payment_signal_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="confirmed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="fractional_purchases_confirmed",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="fractionalgoldpurchase",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending_payment", "Pending payment"),
                    ("signal_received", "Payment signal received"),
                    ("awaiting_counter", "Awaiting counter confirmation"),
                    ("awaiting_utr_verify", "Awaiting UTR verification"),
                    ("pending_review", "Pending jeweller review"),
                    ("needs_manual_verification", "Needs manual verification"),
                    ("completed", "Completed"),
                    ("rejected", "Rejected"),
                    ("cancelled", "Cancelled"),
                ],
                default="pending_payment",
                max_length=32,
            ),
        ),
        migrations.CreateModel(
            name="PaymentSignal",
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
                (
                    "amount_inr",
                    models.DecimalField(
                        blank=True, decimal_places=2, max_digits=14, null=True
                    ),
                ),
                ("timestamp", models.DateTimeField()),
                ("upi_vpa", models.CharField(blank=True, max_length=128)),
                ("utr", models.CharField(blank=True, max_length=32)),
                ("sms_reference", models.TextField(blank=True)),
                (
                    "source",
                    models.CharField(
                        choices=[
                            ("upi_intent", "UPI intent metadata"),
                            ("user_input", "User input"),
                            ("sms_parse", "SMS parse"),
                            ("jeweller_confirmation", "Jeweller confirmation"),
                        ],
                        max_length=32,
                    ),
                ),
                ("parsed_payload", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "fractional_purchase",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="payment_signals",
                        to="accounts.fractionalgoldpurchase",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="PlatformSettlementBatch",
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
                ("period_label", models.CharField(max_length=64)),
                ("net_payable_inr", models.DecimalField(decimal_places=2, max_digits=18)),
                ("settled_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "jeweller",
                    models.ForeignKey(
                        limit_choices_to={"user_type": "jeweller"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="platform_settlement_batches",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="PlatformCommercialLedgerEntry",
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
                ("amount_inr", models.DecimalField(decimal_places=2, max_digits=14)),
                (
                    "kind",
                    models.CharField(
                        choices=[("spread_fee", "Spread fee")],
                        default="spread_fee",
                        max_length=32,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending_settlement", "Pending settlement"),
                            ("settled", "Settled"),
                        ],
                        default="pending_settlement",
                        max_length=32,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "fractional_purchase",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="platform_commercial_entries",
                        to="accounts.fractionalgoldpurchase",
                    ),
                ),
                (
                    "jeweller",
                    models.ForeignKey(
                        limit_choices_to={"user_type": "jeweller"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="platform_commercial_entries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "settlement_batch",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="entries",
                        to="accounts.platformsettlementbatch",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="best_payment_signal",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="accounts.paymentsignal",
            ),
        ),
        migrations.RunPython(
            migrate_awaiting_utr_to_pending_review,
            migrations.RunPython.noop,
        ),
    ]
