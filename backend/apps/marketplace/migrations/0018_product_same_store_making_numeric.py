from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0017_goldticker_hourly_gold_push"),
    ]

    operations = [
        migrations.AddField(
            model_name="marketplaceproduct",
            name="same_store_making_charge_percent",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text="When making_charge_mode is percent: making charge as percent of gold metal for same-store (default jeweller) customers.",
                max_digits=8,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="marketplaceproduct",
            name="same_store_making_charge_per_gram",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="When making_charge_mode is fixed: MC ₹/g for same-store customers.",
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="marketplaceproduct",
            name="same_store_benefit_note",
            field=models.CharField(
                blank=True,
                help_text="Legacy text line; prefer same_store_making_charge_* for pricing.",
                max_length=255,
            ),
        ),
    ]
