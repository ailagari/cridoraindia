# Storefront comparison and card fields for jeweller marketplace listings

from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0002_storefront_comparison_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="logo_url",
            field=models.URLField(blank=True, help_text="Shown on jeweller marketplace cards.", max_length=512),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="credibility_score",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="0–100 trust score for marketplace cards (optional).",
                max_digits=5,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="lock_in_summary",
            field=models.CharField(
                blank=True,
                help_text="E.g. 30 days · none optional — shown on marketplace card.",
                max_length=240,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="minimum_redeemable_grams",
            field=models.DecimalField(
                blank=True,
                decimal_places=3,
                max_digits=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="same_store_mc_benefit",
            field=models.CharField(
                blank=True,
                help_text="Same-store making charge benefit line (e.g. 0% MC).",
                max_length=240,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="cross_redemption_fee_note",
            field=models.CharField(
                blank=True,
                help_text="Cross-jeweller / platform fee disclosure.",
                max_length=240,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="metric_active_users",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="metric_total_redeemed_gold_grams",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("0"),
                max_digits=14,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="metric_years_active",
            field=models.DecimalField(decimal_places=1, default=Decimal("0"), max_digits=5),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="feat_instant_redemption",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="feat_zero_mc_same_store",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="feat_loan_available",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="feat_goldnest_available",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="feat_emergency_funds",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="feat_cross_redemption",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="marketplaceproduct",
            name="same_store_benefit_note",
            field=models.CharField(
                blank=True,
                help_text="Optional per-SKU same-store benefit line on product cards.",
                max_length=255,
            ),
        ),
    ]
