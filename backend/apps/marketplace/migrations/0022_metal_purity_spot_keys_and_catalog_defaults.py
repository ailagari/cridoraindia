from decimal import Decimal

from django.db import migrations, models


def seed_catalog(apps, schema_editor):
    from apps.marketplace.catalog_defaults import ensure_marketplace_catalog_defaults

    ensure_marketplace_catalog_defaults()


def backfill_spot_fields(apps, schema_editor):
    MetalPurity = apps.get_model("marketplace", "MetalPurity")
    defaults = {
        "bis916": ("gold", "22K", Decimal("0.9160")),
        "916": ("gold", "22K", Decimal("0.9160")),
        "bis875": ("gold", "21K", Decimal("0.8750")),
        "bis750": ("gold", "18K", Decimal("0.7500")),
        "bis999": ("gold", "24K", Decimal("0.9990")),
        "24k": ("gold", "24K", Decimal("0.9990")),
        "24K": ("gold", "24K", Decimal("0.9990")),
        "999": ("gold", "24K", Decimal("0.9990")),
        "silver999": ("silver", "999", Decimal("1.0000")),
        "silver925": ("silver", "925", Decimal("0.9250")),
    }
    for row in MetalPurity.objects.all().iterator():
        key = (row.slug or "").strip()
        spec = defaults.get(key) or defaults.get(key.lower())
        if not spec:
            continue
        family, spot_key, frac = spec
        row.spot_family = family
        row.spot_key = spot_key
        row.fine_fraction = frac
        row.save(update_fields=["spot_family", "spot_key", "fine_fraction"])


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0021_gold_ticker_reference_history"),
    ]

    operations = [
        migrations.AddField(
            model_name="metalpurity",
            name="spot_family",
            field=models.CharField(
                choices=[("gold", "Gold"), ("silver", "Silver")],
                default="gold",
                help_text="Which live ticker ladder to use (gold 22K/24K/… or silver 999/925).",
                max_length=8,
            ),
        ),
        migrations.AddField(
            model_name="metalpurity",
            name="spot_key",
            field=models.CharField(
                default="22K",
                help_text="Key in public spot payload, e.g. 22K, 24K, 999.",
                max_length=8,
            ),
        ),
        migrations.RunPython(backfill_spot_fields, migrations.RunPython.noop),
        migrations.RunPython(seed_catalog, migrations.RunPython.noop),
    ]
