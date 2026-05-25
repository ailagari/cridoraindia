from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0047_fractional_vyapar_gateway"),
    ]

    operations = [
        migrations.RemoveField(model_name="fractionalgoldpurchase", name="upi_collection_rail"),
        migrations.RemoveField(model_name="fractionalgoldpurchase", name="vyapar_client_txn_id"),
        migrations.RemoveField(model_name="fractionalgoldpurchase", name="vyapar_order_id"),
        migrations.RemoveField(model_name="fractionalgoldpurchase", name="vyapar_pay_url"),
        migrations.RemoveField(model_name="fractionalgoldpurchase", name="vyapar_upi_intent"),
    ]
