import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0013_festival_broadcast_inapp_link_home"),
    ]

    operations = [
        migrations.CreateModel(
            name="GoldSellbackRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("grams", models.DecimalField(decimal_places=6, max_digits=16)),
                (
                    "reference_metal_inr_per_gram_snapshot",
                    models.DecimalField(
                        decimal_places=2,
                        help_text="Jeweller reference 22K metal ₹/g at quote time (before sellback spread).",
                        max_digits=12,
                    ),
                ),
                (
                    "buyback_inr_per_gram_snapshot",
                    models.DecimalField(
                        decimal_places=2,
                        help_text="Indicative buyback ₹/g credited to customer (policy + headline rules).",
                        max_digits=12,
                    ),
                ),
                (
                    "cash_estimate_inr",
                    models.DecimalField(
                        decimal_places=2,
                        help_text="grams × buyback ₹/g at execution.",
                        max_digits=16,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("completed", "Completed")],
                        default="completed",
                        max_length=24,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "customer",
                    models.ForeignKey(
                        limit_choices_to={"user_type": "customer"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="gold_sellbacks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "jeweller",
                    models.ForeignKey(
                        limit_choices_to={"user_type": "jeweller"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="gold_sellbacks_as_jeweller",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddField(
            model_name="jewellerliabilityledgerentry",
            name="kind",
            field=models.CharField(
                choices=[
                    ("fractional_credit", "Fractional credit"),
                    ("sellback_release", "Sellback release"),
                ],
                default="fractional_credit",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="jewellerliabilityledgerentry",
            name="gold_sellback",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sellback_liability_entries",
                to="accounts.goldsellbackrequest",
            ),
        ),
    ]
