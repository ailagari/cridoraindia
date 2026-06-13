from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0033_akgsma_board_24k_history"),
    ]

    operations = [
        migrations.CreateModel(
            name="KeralaGoldRateDaily",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("rate_date", models.DateField(db_index=True, unique=True)),
                ("inr_per_gram_24k", models.DecimalField(decimal_places=2, max_digits=12)),
                ("inr_per_gram_22k", models.DecimalField(decimal_places=2, max_digits=12)),
                ("inr_per_gram_18k", models.DecimalField(decimal_places=2, max_digits=12)),
                ("silver_999_inr", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("source", models.CharField(blank=True, default="", max_length=64)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name_plural": "Kerala gold rate daily (public)",
                "ordering": ["-rate_date"],
            },
        ),
    ]
