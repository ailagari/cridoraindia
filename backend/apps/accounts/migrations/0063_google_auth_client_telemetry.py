from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0062_festival_broadcast_tap_links"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="auth_provider",
            field=models.CharField(
                choices=[("email", "Email"), ("google", "Google")],
                default="email",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="google_sub",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Google account subject id (stable OAuth identifier).",
                max_length=128,
                null=True,
                unique=True,
            ),
        ),
        migrations.CreateModel(
            name="ClientDeviceSession",
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
                ("client_id", models.CharField(db_index=True, max_length=64, unique=True)),
                (
                    "surface",
                    models.CharField(
                        choices=[
                            ("browser", "Browser"),
                            ("pwa", "PWA"),
                            ("native_android", "Native Android"),
                            ("native_ios", "Native iOS"),
                        ],
                        default="browser",
                        max_length=24,
                    ),
                ),
                (
                    "push_permission",
                    models.CharField(
                        choices=[
                            ("default", "Default"),
                            ("granted", "Granted"),
                            ("denied", "Denied"),
                            ("unsupported", "Unsupported"),
                        ],
                        default="default",
                        max_length=16,
                    ),
                ),
                ("push_registered", models.BooleanField(default=False)),
                ("pwa_installed_at", models.DateTimeField(blank=True, null=True)),
                ("user_agent", models.CharField(blank=True, default="", max_length=512)),
                ("preferred_locale", models.CharField(blank=True, default="en", max_length=8)),
                ("first_seen_at", models.DateTimeField(auto_now_add=True)),
                ("last_seen_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="client_device_sessions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-last_seen_at"],
                "indexes": [
                    models.Index(fields=["surface", "last_seen_at"], name="accounts_cl_surface_8a1f0d_idx"),
                    models.Index(
                        fields=["push_registered", "last_seen_at"],
                        name="accounts_cl_push_re_4c2b91_idx",
                    ),
                ],
            },
        ),
    ]
