from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0057_rename_accounts_pu_status__a1b2c3_idx_accounts_pu_status_2d0026_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="personalgoldholding",
            name="making_charge_percent",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Optional: making charge as % of metal value at purchase.",
                max_digits=7,
                null=True,
            ),
        ),
    ]
