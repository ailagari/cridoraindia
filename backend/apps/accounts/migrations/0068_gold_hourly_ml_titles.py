from django.db import migrations


def seed_hourly_ml_titles(apps, schema_editor):
    SystemNotificationMessage = apps.get_model("accounts", "SystemNotificationMessage")
    rows = [
        {
            "key": "gold_hourly_push_title_up",
            "locale": "ml",
            "name": "Hourly digest — rate up (Malayalam)",
            "group": "gold",
            "description": "Malayalam hourly digest title when price increased.",
            "title_template": "ഗോൾഡ് നിരക്ക് കൂടി",
            "body_template": "",
            "variables": [],
        },
        {
            "key": "gold_hourly_push_title_down",
            "locale": "ml",
            "name": "Hourly digest — rate down (Malayalam)",
            "group": "gold",
            "description": "Malayalam hourly digest title when price decreased.",
            "title_template": "ഗോൾഡ് നിരക്ക് കുറഞ്ഞു",
            "body_template": "",
            "variables": [],
        },
    ]
    for row in rows:
        SystemNotificationMessage.objects.update_or_create(
            key=row["key"],
            locale=row["locale"],
            defaults={
                "name": row["name"],
                "group": row["group"],
                "description": row["description"],
                "title_template": row["title_template"],
                "body_template": row["body_template"],
                "variables": row["variables"],
                "alternative_titles": [],
                "alternative_bodies": [],
                "is_active": True,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0067_engagement_malayalam_templates"),
    ]

    operations = [
        migrations.RunPython(seed_hourly_ml_titles, migrations.RunPython.noop),
    ]
