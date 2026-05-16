import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0014_gold_sellback_and_liability_kind"),
    ]

    operations = [
        migrations.CreateModel(
            name="GoldSellbackOtp",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code_hash", models.CharField(max_length=64)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("failed_attempts", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "sellback",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="settlement_otp",
                        to="accounts.goldsellbackrequest",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddField(
            model_name="goldsellbackrequest",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="goldsellbackrequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending_jeweller", "Pending jeweller"),
                    ("rejected", "Rejected"),
                    ("accepted_awaiting_otp", "Accepted awaiting OTP"),
                    ("completed", "Completed"),
                ],
                default="pending_jeweller",
                max_length=32,
            ),
        ),
        migrations.AlterModelOptions(
            name="goldsellbackrequest",
            options={"ordering": ["-updated_at", "-created_at"]},
        ),
    ]
