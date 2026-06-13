# Generated manually for gold rates ad image mode

from django.db import migrations, models

DEFAULT_IMAGES = {
    "top_banner": "/ads/gold-rates-top-banner.svg",
    "sidebar": "/ads/gold-rates-sidebar.svg",
    "in_content_1": "/ads/gold-rates-in-content.svg",
    "in_content_2": "/ads/gold-rates-in-content.svg",
    "footer": "/ads/gold-rates-footer.svg",
}

SLOT_LABELS = {
    "top_banner": "Top banner",
    "sidebar": "Sidebar",
    "in_content_1": "After rate cards",
    "in_content_2": "After chart",
    "footer": "Footer strip",
}


def seed_image_placements(apps, schema_editor):
    Placement = apps.get_model("marketplace", "GoldRatesAdPlacement")
    for slot, image_url in DEFAULT_IMAGES.items():
        p, created = Placement.objects.get_or_create(
            slot=slot,
            defaults={
                "label": SLOT_LABELS.get(slot, slot),
                "mode": "image",
                "image_url": image_url,
                "image_alt": SLOT_LABELS.get(slot, slot),
                "is_active": True,
            },
        )
        if not created and not p.image_url and p.mode != "adsense":
            p.mode = "image"
            p.image_url = image_url
            p.image_alt = p.label or SLOT_LABELS.get(slot, slot)
            p.is_active = True
            p.save(update_fields=["mode", "image_url", "image_alt", "is_active", "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0037_alter_goldratesadplacement_adsense_format_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldratesadplacement",
            name="image_alt",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Alt text for image banners.",
                max_length=160,
            ),
        ),
        migrations.AddField(
            model_name="goldratesadplacement",
            name="image_link_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Optional click-through URL for image banners.",
                max_length=512,
            ),
        ),
        migrations.AddField(
            model_name="goldratesadplacement",
            name="image_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Banner image URL when mode is Image.",
                max_length=512,
            ),
        ),
        migrations.AlterField(
            model_name="goldratesadplacement",
            name="mode",
            field=models.CharField(
                choices=[
                    ("manual", "Manual HTML"),
                    ("image", "Image banner"),
                    ("adsense", "Google AdSense"),
                ],
                default="manual",
                max_length=16,
            ),
        ),
        migrations.RunPython(seed_image_placements, migrations.RunPython.noop),
    ]
