from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0032_akgsma_board_rate_history"),
    ]

    operations = [
        migrations.AddField(
            model_name="akgsmaboardratehistory",
            name="inr_per_gram_24k",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=12, null=True
            ),
        ),
        migrations.AddField(
            model_name="akgsmaboarddailysnapshot",
            name="close_inr_24k",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=12, null=True
            ),
        ),
    ]
