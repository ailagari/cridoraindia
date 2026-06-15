from django.db import migrations, models


def migrate_manual_flag_to_per_metal_sources(apps, schema_editor):
    GoldTickerConfig = apps.get_model("marketplace", "GoldTickerConfig")
    default_gold = {"24K": "live", "22K": "live", "21K": "live", "18K": "live"}
    default_silver = {"999": "live", "925": "live"}
    for ticker in GoldTickerConfig.objects.all():
        mode = "manual" if ticker.manual_ticker_enabled else "live"
        ticker.ticker_metal_source_json = {
            "gold": {k: mode for k in default_gold},
            "silver": {k: mode for k in default_silver},
        }
        ticker.save(update_fields=["ticker_metal_source_json"])


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0042_gold_calculator_page_ads"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="ticker_metal_source_json",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Per-metal published source, e.g. {"gold":{"22K":"live","24K":"manual"},"silver":{"999":"live"}}.',
            ),
        ),
        migrations.AlterField(
            model_name="goldtickerconfig",
            name="manual_ticker_enabled",
            field=models.BooleanField(
                default=False,
                help_text="Legacy global manual flag; superseded by ticker_metal_source_json per-metal toggles.",
            ),
        ),
        migrations.RunPython(migrate_manual_flag_to_per_metal_sources, migrations.RunPython.noop),
    ]
