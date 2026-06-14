"""Seed published scheme templates from preset chips."""

from django.db import migrations
from django.utils import timezone
from django.utils.text import slugify


def seed_presets(apps, schema_editor):
    SchemeTemplate = apps.get_model("schemes", "SchemeTemplate")
    from apps.schemes.services.presets import PRESETS
    from apps.schemes.services.scheme_design_compiler import (
        compile_scheme_design,
        human_flow_summary,
    )

    for key, preset in PRESETS.items():
        design = preset["design"]
        slug = slugify(key)[:80]
        if SchemeTemplate.objects.filter(slug=slug).exists():
            continue
        SchemeTemplate.objects.create(
            slug=slug,
            name=preset["label"],
            description=preset.get("description", ""),
            category="preset",
            scheme_design=design,
            scheme_rules=compile_scheme_design(design),
            flow_summary=human_flow_summary(design),
            status="published",
            published_at=timezone.now(),
            sort_order=list(PRESETS.keys()).index(key),
        )


def unseed(apps, schema_editor):
    SchemeTemplate = apps.get_model("schemes", "SchemeTemplate")
    from apps.schemes.services.presets import PRESETS

    slugs = [slugify(k)[:80] for k in PRESETS]
    SchemeTemplate.objects.filter(slug__in=slugs, category="preset").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("schemes", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_presets, unseed),
    ]
