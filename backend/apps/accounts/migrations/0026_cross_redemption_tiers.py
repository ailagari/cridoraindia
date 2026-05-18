# Generated manually for cross-redemption tier limits and source OTP.

from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0025_nativepushtoken"),
    ]

    operations = [
        migrations.AddField(
            model_name="jewellercrosspolicy",
            name="auth_expiry_minutes",
            field=models.PositiveIntegerField(
                default=15,
                help_text="Minutes before pending source approval expires.",
            ),
        ),
        migrations.AddField(
            model_name="jewellercrosspolicy",
            name="auto_cross_grams_per_day",
            field=models.DecimalField(
                decimal_places=4,
                default=Decimal("20"),
                help_text="Max grams/day auto-approved at source (0 = no auto cap).",
                max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name="jewellercrosspolicy",
            name="auto_cross_inr_per_day",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("200000"),
                help_text="Max INR/day auto-approved at source (0 = no auto cap).",
                max_digits=18,
            ),
        ),
        migrations.AddField(
            model_name="jewellercrosspolicy",
            name="daily_txn_count_limit",
            field=models.PositiveIntegerField(
                default=25,
                help_text="Above this count/day → manual approval (0 = off).",
            ),
        ),
        migrations.AddField(
            model_name="jewellercrosspolicy",
            name="single_txn_gram_limit",
            field=models.DecimalField(
                decimal_places=4,
                default=Decimal("10"),
                help_text="Above this grams per txn → manual approval (0 = off).",
                max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name="jewellercrosspolicy",
            name="single_txn_inr_limit",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("100000"),
                help_text="Above this INR per txn → manual approval (0 = off).",
                max_digits=18,
            ),
        ),
        migrations.AlterField(
            model_name="jewellercrosspolicy",
            name="require_source_approval",
            field=models.BooleanField(
                default=False,
                help_text="When true, every cross-redemption from this jeweller needs manual source approval.",
            ),
        ),
        migrations.AddField(
            model_name="crossredemptionrequest",
            name="auth_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="crossredemptionrequest",
            name="auth_tier",
            field=models.CharField(
                choices=[("auto", "Auto"), ("manual", "Manual")],
                default="manual",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="crossredemptionrequest",
            name="public_reference",
            field=models.CharField(blank=True, db_index=True, max_length=32),
        ),
        migrations.AlterField(
            model_name="crossredemptionrequest",
            name="workflow_state",
            field=models.CharField(
                choices=[
                    ("awaiting_destination", "Awaiting destination"),
                    ("awaiting_source", "Awaiting source"),
                    ("saga_pending", "Saga pending"),
                    ("saga_done", "Saga done"),
                ],
                default="awaiting_source",
                max_length=32,
            ),
        ),
        migrations.CreateModel(
            name="CrossRedemptionApprovalOtp",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code_hash", models.CharField(max_length=64)),
                ("expires_at", models.DateTimeField()),
                ("failed_attempts", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "request",
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name="source_approval_otp",
                        to="accounts.crossredemptionrequest",
                    ),
                ),
            ],
            options={
                "verbose_name": "Cross-redemption source approval OTP",
            },
        ),
    ]
