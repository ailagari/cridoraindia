from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0035_gold_loan_term_repayment"),
    ]

    operations = [
        migrations.CreateModel(
            name="JewellerRevenueBalance",
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
                    "total_revenue_inr",
                    models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=16),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "jeweller",
                    models.OneToOneField(
                        limit_choices_to={"user_type": "jeweller"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="revenue_balance",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="JewellerRevenueLedgerEntry",
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
                    "kind",
                    models.CharField(
                        choices=[
                            ("fractional_sale", "Fractional gold sale"),
                            ("loan_processing_fee", "Gold loan processing fee share"),
                            ("ornament_sale", "Ornament / vault product sale"),
                            ("deposit_intake", "Gold deposit intake"),
                        ],
                        max_length=32,
                    ),
                ),
                ("reference_label", models.CharField(blank=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "customer",
                    models.ForeignKey(
                        blank=True,
                        limit_choices_to={"user_type": "customer"},
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="jeweller_revenue_entries_as_customer",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "fractional_purchase",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="revenue_entries",
                        to="accounts.fractionalgoldpurchase",
                    ),
                ),
                (
                    "gold_deposit_intake",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="revenue_entries",
                        to="accounts.golddepositintake",
                    ),
                ),
                (
                    "gold_loan",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="revenue_entries",
                        to="accounts.goldloanrequest",
                    ),
                ),
                (
                    "jeweller",
                    models.ForeignKey(
                        limit_choices_to={"user_type": "jeweller"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="revenue_ledger_entries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "vault_product_redemption",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="revenue_entries",
                        to="accounts.vaultproductredemption",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="jewellerrevenueledgerentry",
            constraint=models.UniqueConstraint(
                condition=models.Q(("gold_loan__isnull", False), ("kind", "loan_processing_fee")),
                fields=("gold_loan", "kind"),
                name="uniq_jeweller_revenue_loan_fee",
            ),
        ),
    ]
