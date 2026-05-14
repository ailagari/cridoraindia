from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0009_jewellerpricingprofile_gold_rate_external_api_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="golden_scheme_benefits",
            field=models.TextField(
                blank=True,
                help_text="Benefits narrative (bonus months, ornament benefits, etc.).",
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="golden_scheme_duration_months",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text="Typical plan duration in months (MVP disclosure).",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="golden_scheme_enabled",
            field=models.BooleanField(
                default=False,
                help_text="Jeweller offers a Golden Scheme (monthly jewellery savings) disclosure on storefront.",
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="golden_scheme_lock_in_note",
            field=models.CharField(
                blank=True,
                help_text="Lock-in / tenure rules for the scheme (customer-facing).",
                max_length=240,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="golden_scheme_min_monthly_inr",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Minimum monthly contribution (₹) disclosed to customers.",
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="golden_scheme_rate_application_note",
            field=models.CharField(
                blank=True,
                help_text="How gold rate applies e.g. at investment vs redemption (MVP disclosure).",
                max_length=280,
            ),
        ),
    ]
