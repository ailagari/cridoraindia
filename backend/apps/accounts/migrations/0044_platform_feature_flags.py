from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0043_loan_repayment_reconciliation"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformoperationalsettings",
            name="feature_flags",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Admin overrides for platform feature rollout (key -> bool).",
            ),
        ),
    ]
