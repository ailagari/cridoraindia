from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0028_festival_broadcast_image_url"),
    ]

    operations = [
        migrations.AlterField(
            model_name="fractionalgoldpurchase",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending_payment", "Pending payment"),
                    ("awaiting_counter", "Awaiting counter confirmation"),
                    ("awaiting_utr_verify", "Awaiting UTR verification"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                ],
                default="pending_payment",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="payee_upi_vpa",
            field=models.CharField(
                blank=True,
                help_text="Snapshot of jeweller UPI VPA when the order was created.",
                max_length=128,
            ),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="payment_note",
            field=models.CharField(
                blank=True,
                help_text="UPI transaction note, e.g. Cridora FR-42.",
                max_length=128,
            ),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="payment_expires_at",
            field=models.DateTimeField(
                blank=True,
                help_text="When an unfunded UPI order should expire.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="upi_utr",
            field=models.CharField(
                blank=True,
                help_text="Customer-submitted UPI reference number.",
                max_length=32,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="fractionalgoldpurchase",
            name="utr_submitted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
