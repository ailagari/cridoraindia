# Fixes page_title values that lost their em dash to mojibake (U+FFFD)
# after being saved through the admin panel with a non-UTF-8 client encoding.

from django.db import migrations

CLEAN_GOLD_RATES_TITLE = "Kerala Gold Rate Today — Live 22K, 24K & Silver"
CLEAN_GOLD_CALCULATOR_TITLE = "Gold Jewellery Price Calculator India — Live 22K & 24K"


def _is_corrupted(value: str) -> bool:
    return "\ufffd" in value


def fix_corrupted_titles(apps, schema_editor):
    GoldRatesPageConfig = apps.get_model("marketplace", "GoldRatesPageConfig")
    GoldCalculatorPageConfig = apps.get_model("marketplace", "GoldCalculatorPageConfig")

    for cfg in GoldRatesPageConfig.objects.all():
        if _is_corrupted(cfg.page_title):
            cfg.page_title = CLEAN_GOLD_RATES_TITLE
            cfg.save(update_fields=["page_title"])

    for cfg in GoldCalculatorPageConfig.objects.all():
        if _is_corrupted(cfg.page_title):
            cfg.page_title = CLEAN_GOLD_CALCULATOR_TITLE
            cfg.save(update_fields=["page_title"])


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0046_goldtickerconfig_engagement_malayalam_enabled"),
    ]

    operations = [
        migrations.RunPython(fix_corrupted_titles, migrations.RunPython.noop),
    ]
