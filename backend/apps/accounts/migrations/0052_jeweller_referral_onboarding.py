# Generated manually for jeweller referral onboarding

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_jeweller_referral_codes(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    import secrets

    from django.db.models import Q

    verified = User.objects.filter(
        user_type="jeweller",
        kyc_status="verified",
    ).filter(Q(jeweller_referral_code__isnull=True) | Q(jeweller_referral_code=""))
    used = set(
        User.objects.exclude(jeweller_referral_code__isnull=True)
        .exclude(jeweller_referral_code="")
        .values_list("jeweller_referral_code", flat=True)
    )
    for jeweller in verified.iterator():
        if (jeweller.jeweller_referral_code or "").strip():
            continue
        for _ in range(64):
            code = "".join(secrets.choice("0123456789") for _ in range(6))
            if code in used:
                continue
            used.add(code)
            jeweller.jeweller_referral_code = code
            jeweller.save(update_fields=["jeweller_referral_code"])
            break


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0051_campaign_templates_analytics"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="jeweller_referral_code",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="6-digit code for customer signup onboarding (verified jewellers only).",
                max_length=6,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="onboarded_by_jeweller",
            field=models.ForeignKey(
                blank=True,
                help_text="Jeweller who referred or onboarded this customer at signup.",
                limit_choices_to={"user_type": "jeweller"},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="onboarded_customers",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(
            backfill_jeweller_referral_codes,
            migrations.RunPython.noop,
        ),
    ]
