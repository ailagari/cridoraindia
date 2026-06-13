from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0031_engagement_engine_ticker"),
    ]

    operations = [
        migrations.CreateModel(
            name="AkgsmaBoardRateHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("recorded_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("inr_per_gram_22k", models.DecimalField(decimal_places=2, max_digits=12)),
                ("inr_per_gram_18k", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("silver_999_inr", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("board_date", models.CharField(blank=True, default="", max_length=32)),
                ("source", models.CharField(blank=True, default="", max_length=64)),
            ],
            options={
                "verbose_name_plural": "AKGSMA board rate history",
                "ordering": ["-recorded_at"],
            },
        ),
        migrations.CreateModel(
            name="AkgsmaBoardDailySnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("snapshot_date", models.DateField(db_index=True, unique=True)),
                ("open_inr_22k", models.DecimalField(decimal_places=2, max_digits=12)),
                ("high_inr_22k", models.DecimalField(decimal_places=2, max_digits=12)),
                ("low_inr_22k", models.DecimalField(decimal_places=2, max_digits=12)),
                ("close_inr_22k", models.DecimalField(decimal_places=2, max_digits=12)),
                ("close_inr_18k", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("silver_999_inr", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("board_date", models.CharField(blank=True, default="", max_length=32)),
                ("source", models.CharField(blank=True, default="", max_length=64)),
                ("sample_count", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name_plural": "AKGSMA board daily snapshots",
                "ordering": ["-snapshot_date"],
            },
        ),
    ]
