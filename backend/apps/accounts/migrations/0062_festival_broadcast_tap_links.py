from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0061_personal_holding_purchase_total_inr"),
    ]

    operations = [
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="link_path_guest",
            field=models.CharField(
                default="/",
                help_text="In-app path when a guest (not signed in) taps this push.",
                max_length=512,
            ),
        ),
        migrations.AddField(
            model_name="festivalbroadcastnotification",
            name="link_path_authenticated",
            field=models.CharField(
                default="/userdashboard?section=portfolio_overview",
                help_text="In-app path when a signed-in user taps this push.",
                max_length=512,
            ),
        ),
    ]
