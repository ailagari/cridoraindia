# Generated manually for metal pricing JSON + platform deposit/loan disclosures.

from decimal import Decimal

from django.db import migrations, models


METAL_CODES = (
    "gold_22k",
    "gold_24k",
    "gold_21k",
    "gold_18k",
    "silver_999",
    "silver_925",
)


def _dec_str(v, default="0"):
    if v is None:
        return default
    try:
        d = Decimal(str(v))
        if d < 0:
            d = Decimal("0")
        return format(d.normalize(), "f")
    except Exception:
        return default


def _default_pricing_block():
    return {
        "mode": "match_cridora",
        "markup_percent": "0",
        "markup_inr_per_gram": "0",
        "manual_inr_per_gram": "0",
        "external_api_url": "",
    }


def _default_buyback_block():
    return {
        "deduction_percent": "0",
        "fixed_inr_per_gram": "0",
        "jeweller_deduction_inr_per_gram": "0",
    }


def forwards_populate_metal_json(apps, schema_editor):
    Profile = apps.get_model("marketplace", "JewellerPricingProfile")
    for row in Profile.objects.all():
        if row.metal_pricing_json:
            continue
        pmap = {c: _default_pricing_block() for c in METAL_CODES}
        bmap = {c: _default_buyback_block() for c in METAL_CODES}

        if row.gold_rate_source == "manual":
            pmap["gold_22k"] = {
                "mode": "manual_board_inr",
                "markup_percent": "0",
                "markup_inr_per_gram": "0",
                "manual_inr_per_gram": _dec_str(row.manual_gold_rate_inr_per_gram, "0"),
                "external_api_url": str(row.gold_rate_external_api_url or "")[:512],
            }
        else:
            has_markup = row.live_markup_percent != 0 or row.live_markup_inr_per_gram != 0
            pmap["gold_22k"] = {
                "mode": "markup_on_cridora" if has_markup else "match_cridora",
                "markup_percent": _dec_str(row.live_markup_percent, "0"),
                "markup_inr_per_gram": _dec_str(row.live_markup_inr_per_gram, "0"),
                "manual_inr_per_gram": "0",
                "external_api_url": str(row.gold_rate_external_api_url or "")[:512],
            }

        bmap["gold_22k"] = {
            "deduction_percent": _dec_str(row.sellback_deduction_percent, "0"),
            "fixed_inr_per_gram": _dec_str(row.sellback_fixed_inr_per_gram, "0"),
            "jeweller_deduction_inr_per_gram": "0",
        }

        row.metal_pricing_json = pmap
        row.metal_buyback_json = bmap
        row.save(update_fields=["metal_pricing_json", "metal_buyback_json"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0010_jewellerpricingprofile_golden_scheme"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="gold_deposit_yield_apr_percent",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("0"),
                help_text="Platform-disclosed gold deposit / saver yield (% APR) shown on jeweller storefronts.",
                max_digits=8,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="gold_loan_interest_apr_percent",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("0"),
                help_text="Platform-disclosed gold-backed loan interest (% APR).",
                max_digits=8,
            ),
        ),
        migrations.AddField(
            model_name="goldtickerconfig",
            name="gold_loan_processing_fee_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Platform-disclosed one-time processing fee (₹) for gold loans.",
                max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="metal_pricing_json",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Per-metal pricing modes vs Cridora reference (gold/silver purities).",
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="metal_buyback_json",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Per-metal sellback deduction blocks.",
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="gold_loan_jeweller_deduction_inr_per_gram",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Jeweller-disclosed extra ₹/g adjustment vs live loan reference (storefront disclosure).",
                max_digits=12,
            ),
        ),
        migrations.RunPython(forwards_populate_metal_json, noop_reverse),
    ]
