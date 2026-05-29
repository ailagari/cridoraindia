from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0050_inbox_notification_prefs"),
    ]

    operations = [
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="target_type",
            field=models.CharField(
                choices=[
                    ("ALL_USERS", "All customers"),
                    ("ALL_APP_INSTALLS", "All app installs"),
                    ("SPECIFIC_JEWELLER_USERS", "Jeweller customers"),
                    ("DEFAULT_JEWELLER_USERS", "Default jeweller customers"),
                    ("SPECIFIC_USERS", "Specific users"),
                ],
                default="ALL_USERS",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="target_metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="logo_url",
            field=models.URLField(blank=True, default="", max_length=512),
        ),
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="created_by_jeweller",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="jeweller_campaign_broadcasts",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="portfoliousernotification",
            name="delivered_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="portfoliousernotification",
            name="clicked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="NotificationTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True)),
                ("category", models.CharField(default="promo", max_length=24)),
                ("tone", models.CharField(blank=True, default="", max_length=24)),
                ("title_template", models.CharField(max_length=180)),
                ("body_template", models.TextField()),
                ("variables", models.JSONField(blank=True, default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="NotificationEventLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(choices=[("delivered", "Delivered"), ("clicked", "Clicked")], max_length=16)),
                ("category", models.CharField(blank=True, default="", max_length=24)),
                ("kind", models.CharField(blank=True, default="", max_length=32)),
                ("title", models.CharField(blank=True, default="", max_length=180)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="notification_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="notificationeventlog",
            index=models.Index(fields=["event_type", "created_at"], name="accounts_no_event_t_6e8b0a_idx"),
        ),
        migrations.AddIndex(
            model_name="notificationeventlog",
            index=models.Index(fields=["user", "event_type"], name="accounts_no_user_id_8f3c2d_idx"),
        ),
    ]
