from django.db import migrations


def forwards(apps, schema_editor):
    AdminNotification = apps.get_model("accounts", "AdminNotification")
    AdminNotification.objects.filter(
        kind="festival_broadcast_sent",
        link_path="/dashboard/admin?section=plat_festival",
    ).update(link_path="/")


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0012_webpushsubscription_anonymous_user"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
