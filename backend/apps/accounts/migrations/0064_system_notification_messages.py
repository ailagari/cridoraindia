from django.db import migrations, models


def seed_system_notifications(apps, schema_editor):
    SystemNotificationMessage = apps.get_model("accounts", "SystemNotificationMessage")
    from apps.accounts.services.system_notification_catalog import SYSTEM_NOTIFICATION_CATALOG

    for row in SYSTEM_NOTIFICATION_CATALOG:
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
        ("accounts", "0063_google_auth_client_telemetry"),
    ]

    operations = [
        migrations.CreateModel(
            name="SystemNotificationMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(db_index=True, max_length=64)),
                ("name", models.CharField(help_text="Admin display label.", max_length=160)),
                ("group", models.CharField(db_index=True, default="transaction", max_length=32)),
                ("locale", models.CharField(db_index=True, default="en", max_length=8)),
                ("description", models.TextField(blank=True, default="")),
                ("title_template", models.CharField(blank=True, default="", max_length=180)),
                ("body_template", models.TextField(blank=True, default="")),
                ("alternative_titles", models.JSONField(blank=True, default=list)),
                ("alternative_bodies", models.JSONField(blank=True, default=list)),
                ("variables", models.JSONField(blank=True, default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["group", "key", "locale"],
            },
        ),
        migrations.AddConstraint(
            model_name="systemnotificationmessage",
            constraint=models.UniqueConstraint(
                fields=("key", "locale"),
                name="uniq_system_notification_key_locale",
            ),
        ),
        migrations.RunPython(seed_system_notifications, migrations.RunPython.noop),
    ]
