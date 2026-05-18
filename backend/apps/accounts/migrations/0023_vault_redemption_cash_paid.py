from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0022_cross_redemption_ledger_rollback_kinds"),
    ]

    operations = [
        migrations.AddField(
            model_name="vaultproductredemption",
            name="cash_paid_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="Cash/UPI collected at checkout (balance after vault grams).",
                max_digits=16,
            ),
        ),
        migrations.AddField(
            model_name="vaultproductredemption",
            name="cash_payment_method",
            field=models.CharField(
                blank=True,
                default="",
                help_text="counter_cash, counter_upi, card_demo, etc.",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="vaultproductredemption",
            name="gst_on_gold_saved_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="GST on gold not charged because metal was paid from taxed vault.",
                max_digits=12,
            ),
        ),
    ]
