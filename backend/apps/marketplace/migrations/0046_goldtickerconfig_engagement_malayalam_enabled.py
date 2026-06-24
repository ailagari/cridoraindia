from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0045_alter_goldcalculatoradplacement_manual_html_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="goldtickerconfig",
            name="engagement_malayalam_enabled",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "When on, portfolio and gold movement inbox alerts use Malayalam templates "
                    "for users whose device locale is Malayalam. Tray broadcasts include ML payloads."
                ),
            ),
        ),
    ]
