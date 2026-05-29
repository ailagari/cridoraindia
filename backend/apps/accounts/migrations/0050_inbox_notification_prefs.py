from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0049_settlement_payment_method_otp"),
    ]

    operations = [
        migrations.AddField(
            model_name="portfoliousernotification",
            name="category",
            field=models.CharField(
                choices=[
                    ("transaction", "Transaction"),
                    ("portfolio", "Portfolio"),
                    ("security", "Security"),
                    ("promo", "Promo"),
                    ("loan", "Loan"),
                    ("system", "System"),
                ],
                default="portfolio",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="portfoliousernotification",
            name="priority",
            field=models.CharField(
                choices=[("high", "High"), ("medium", "Medium"), ("low", "Low")],
                default="medium",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="portfoliousernotification",
            name="notification_type",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="portfoliousernotification",
            name="jeweller",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="portfoliousernotification",
            name="image_url",
            field=models.URLField(blank=True, default="", max_length=512),
        ),
        migrations.AddField(
            model_name="portfoliousernotification",
            name="logo_url",
            field=models.URLField(blank=True, default="", max_length=512),
        ),
        migrations.AlterField(
            model_name="portfoliousernotification",
            name="kind",
            field=models.CharField(
                choices=[
                    ("holding_added", "Holding added"),
                    ("jeweller_added_holding", "Jeweller added holding"),
                    ("document_uploaded", "Document uploaded"),
                    ("verification_updated", "Verification updated"),
                    ("fractional", "Fractional gold"),
                    ("deposit", "Gold deposit"),
                    ("sellback", "Sellback"),
                    ("loan", "Loan"),
                    ("corridorapay", "CridoraPay"),
                    ("cross_redemption", "Cross redemption"),
                    ("otp", "OTP workflow"),
                    ("system", "System"),
                ],
                max_length=32,
            ),
        ),
        migrations.RunSQL(
            sql="DELETE FROM accounts_portfoliousernotification WHERE read_at IS NOT NULL;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.CreateModel(
            name="NotificationPreference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("allow_promotional", models.BooleanField(default=True)),
                ("allow_gold_alerts", models.BooleanField(default=True)),
                ("allow_portfolio_alerts", models.BooleanField(default=True)),
                ("allow_jeweller_campaigns", models.BooleanField(default=True)),
                ("allow_festival_alerts", models.BooleanField(default=True)),
                ("allow_push_notifications", models.BooleanField(default=True)),
                ("allow_sound", models.BooleanField(default=True)),
                ("quiet_hours_start", models.TimeField(blank=True, null=True)),
                ("quiet_hours_end", models.TimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notification_preference",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
