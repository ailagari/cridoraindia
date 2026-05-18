from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0026_cross_redemption_tiers"),
    ]

    operations = [
        migrations.AddField(
            model_name="vaultproductredemption",
            name="cross_redemption_request",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="vault_product_redemptions",
                to="accounts.crossredemptionrequest",
            ),
        ),
    ]
