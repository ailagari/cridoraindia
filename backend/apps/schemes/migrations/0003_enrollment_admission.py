"""Add pending admission and jeweller-gated payments on scheme enrollments."""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def enable_payments_on_existing(apps, schema_editor):
    CustomerSchemeEnrollment = apps.get_model("schemes", "CustomerSchemeEnrollment")
    CustomerSchemeEnrollment.objects.update(payments_enabled=True)


class Migration(migrations.Migration):
    dependencies = [
        ("schemes", "0002_seed_presets"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="customerschemeenrollment",
            name="payments_enabled",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="customerschemeenrollment",
            name="admitted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="customerschemeenrollment",
            name="admitted_by",
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={"user_type": "jeweller"},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="admitted_scheme_enrollments",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="customerschemeenrollment",
            name="status",
            field=models.CharField(
                choices=[
                    ("active", "Active"),
                    ("pending_admission", "Pending admission"),
                    ("plan_month_complete", "Plan month complete"),
                    ("redeemed", "Redeemed"),
                    ("cancelled", "Cancelled"),
                    ("defaulted", "Defaulted"),
                ],
                db_index=True,
                default="active",
                max_length=32,
            ),
        ),
        migrations.RunPython(enable_payments_on_existing, migrations.RunPython.noop),
    ]
