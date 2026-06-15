from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0041_goldtickerconfig_manual_18k_silver"),
    ]

    operations = [
        migrations.CreateModel(
            name="GoldCalculatorPageConfig",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("adsense_enabled", models.BooleanField(default=False)),
                ("adsense_client_id", models.CharField(blank=True, default="", max_length=64)),
                (
                    "page_title",
                    models.CharField(
                        blank=True,
                        default="Gold Jewellery Price Calculator India — Live 22K & 24K",
                        max_length=160,
                    ),
                ),
                (
                    "page_description",
                    models.CharField(
                        blank=True,
                        default="Estimate ornament price with live gold rates, making charges, and GST. Free calculator for Kerala and India.",
                        max_length=320,
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Gold calculator page config",
            },
        ),
        migrations.CreateModel(
            name="GoldCalculatorAdPlacement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "slot",
                    models.CharField(
                        choices=[
                            ("top_banner", "Top banner"),
                            ("sidebar", "Sidebar"),
                            ("in_content_1", "In content (after calculator)"),
                            ("in_content_2", "In content (after live rates)"),
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
                        choices=[
                            ("manual", "Manual HTML"),
                            ("image", "Image banner"),
                            ("video", "Video banner"),
                            ("media", "Image & video banner"),
                            ("adsense", "Google AdSense"),
                        ],
                        default="manual",
                        max_length=16,
                    ),
                ),
                ("manual_html", models.TextField(blank=True, default="")),
                ("image_url", models.URLField(blank=True, default="", max_length=512)),
                ("image_link_url", models.URLField(blank=True, default="", max_length=512)),
                ("image_alt", models.CharField(blank=True, default="", max_length=160)),
                ("video_url", models.URLField(blank=True, default="", max_length=512)),
                ("video_poster_url", models.URLField(blank=True, default="", max_length=512)),
                ("video_link_url", models.URLField(blank=True, default="", max_length=512)),
                ("video_alt", models.CharField(blank=True, default="", max_length=160)),
                ("adsense_slot_id", models.CharField(blank=True, default="", max_length=64)),
                ("adsense_format", models.CharField(blank=True, default="auto", max_length=24)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Gold calculator ad placement",
                "ordering": ["sort_order", "slot"],
            },
        ),
    ]
