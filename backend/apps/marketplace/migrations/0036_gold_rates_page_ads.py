from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0035_remove_deprecated_ticker_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="GoldRatesPageConfig",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("adsense_enabled", models.BooleanField(default=False)),
                ("adsense_client_id", models.CharField(blank=True, default="", max_length=64)),
                ("page_title", models.CharField(blank=True, default="Kerala Gold Rate Today — Live 22K, 24K & Silver", max_length=160)),
                (
                    "page_description",
                    models.CharField(
                        blank=True,
                        default="Live Kerala gold and silver rates per gram with 2-year history, charts, and jewellery value calculator.",
                        max_length=320,
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Gold rates page config",
            },
        ),
        migrations.CreateModel(
            name="GoldRatesAdPlacement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "slot",
                    models.CharField(
                        choices=[
                            ("top_banner", "Top banner"),
                            ("sidebar", "Sidebar"),
                            ("in_content_1", "In content (after rates)"),
                            ("in_content_2", "In content (after chart)"),
                            ("footer", "Footer strip"),
                        ],
                        max_length=32,
                        unique=True,
                    ),
                ),
                ("label", models.CharField(blank=True, default="", max_length=120)),
                (
                    "mode",
                    models.CharField(
                        choices=[("manual", "Manual HTML"), ("adsense", "Google AdSense")],
                        default="manual",
                        max_length=16,
                    ),
                ),
                ("manual_html", models.TextField(blank=True, default="")),
                ("adsense_slot_id", models.CharField(blank=True, default="", max_length=64)),
                ("adsense_format", models.CharField(blank=True, default="auto", max_length=24)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Gold rates ad placement",
                "ordering": ["sort_order", "slot"],
            },
        ),
    ]
