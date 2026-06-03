# Generated manually for push delivery analytics

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0055_engagement_engine_templates"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notificationeventlog",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("delivered", "Delivered"),
                    ("clicked", "Clicked"),
                    ("read", "Read"),
                    ("tray_delivered", "Tray delivered"),
                    ("tray_clicked", "Tray clicked"),
                ],
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="PushDeliveryAttempt",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "channel",
                    models.CharField(
                        choices=[("webpush", "Web Push"), ("fcm", "FCM")],
                        max_length=16,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("sent", "Sent"),
                            ("failed", "Failed"),
                            ("tray_delivered", "Tray delivered"),
                            ("tray_clicked", "Tray clicked"),
                        ],
                        max_length=20,
                    ),
                ),
                ("tag", models.CharField(blank=True, default="", max_length=64)),
                (
                    "error_message",
                    models.CharField(blank=True, default="", max_length=255),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "portfolio_notification",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="push_attempts",
                        to="accounts.portfoliousernotification",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="push_delivery_attempts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="pushdeliveryattempt",
            index=models.Index(
                fields=["status", "created_at"],
                name="accounts_pu_status__a1b2c3_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="pushdeliveryattempt",
            index=models.Index(
                fields=["user", "channel", "status"],
                name="accounts_pu_user_id__d4e5f6_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="pushdeliveryattempt",
            index=models.Index(
                fields=["portfolio_notification", "status"],
                name="accounts_pu_portfol__g7h8i9_idx",
            ),
        ),
    ]
