# Generated manually — random vault card routing codes.

import secrets

from django.db import migrations, models

ROUTING_SUFFIX = "@cridora"


def _generate_pair(used_digits: set[str], used_addrs: set[str]) -> tuple[str, str]:
    for _ in range(64):
        digits = "".join(secrets.choice("0123456789") for _ in range(10))
        addr = f"{digits}{ROUTING_SUFFIX}"
        if digits in used_digits or addr in used_addrs:
            continue
        used_digits.add(digits)
        used_addrs.add(addr)
        return digits, addr
    raise RuntimeError("Could not allocate unique routing code in migration.")


def assign_random_routing_codes(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    GoldVault = apps.get_model("accounts", "GoldVault")
    used_digits: set[str] = set(
        User.objects.exclude(gold_routing_code__isnull=True)
        .exclude(gold_routing_code="")
        .values_list("gold_routing_code", flat=True)
    )
    used_addrs: set[str] = set(
        GoldVault.objects.exclude(vault_public_id__isnull=True)
        .exclude(vault_public_id="")
        .values_list("vault_public_id", flat=True)
    )

    for user in User.objects.filter(user_type="customer"):
        code = (user.gold_routing_code or "").strip()
        if code and len(code) == 10 and code.isdigit():
            used_digits.add(code)
            continue
        digits, _ = _generate_pair(used_digits, used_addrs)
        User.objects.filter(pk=user.pk).update(gold_routing_code=digits)

    for vault in GoldVault.objects.all().iterator():
        existing = (vault.vault_public_id or "").strip().lower()
        if (
            existing.endswith(ROUTING_SUFFIX)
            and len(existing) == 10 + len(ROUTING_SUFFIX)
            and existing[:10].isdigit()
        ):
            used_addrs.add(existing)
            continue
        _, addr = _generate_pair(used_digits, used_addrs)
        GoldVault.objects.filter(pk=vault.pk).update(vault_public_id=addr)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0023_vault_redemption_cash_paid"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="gold_routing_code",
            field=models.CharField(
                blank=True,
                editable=False,
                help_text="Random 10-digit primary vault routing code (share as code@cridora).",
                max_length=10,
                null=True,
                unique=True,
            ),
        ),
        migrations.AlterField(
            model_name="goldvault",
            name="vault_public_id",
            field=models.CharField(
                blank=True,
                help_text="Public routing ID, e.g. 8472910536@cridora (random, not derived from handle).",
                max_length=160,
                null=True,
                unique=True,
            ),
        ),
        migrations.RunPython(assign_random_routing_codes, migrations.RunPython.noop),
    ]
