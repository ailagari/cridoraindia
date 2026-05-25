from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0046_upi_manual_payment"),
    ]

    operations = [
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="upi_collection_rail",
            field=models.CharField(
                choices=[("manual", "Manual UPI"), ("vyapar_gateway", "VyaparGateway")],
                default="manual",
                help_text="How the customer pays online (manual VPA vs VyaparGateway).",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="vyapar_client_txn_id",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="vyapar_order_id",
            field=models.CharField(blank=True, db_index=True, max_length=128),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="vyapar_pay_url",
            field=models.URLField(blank=True, max_length=512),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="vyapar_upi_intent",
            field=models.CharField(blank=True, max_length=512),
        ),
    ]
