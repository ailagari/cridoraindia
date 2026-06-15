from decimal import Decimal

from django.db import migrations


def _set_india_making_gst_default(apps, schema_editor):
    PlatformOperationalSettings = apps.get_model("accounts", "PlatformOperationalSettings")
    row = PlatformOperationalSettings.objects.filter(pk=1).first()
    if row is None:
        return
    if Decimal(str(row.gst_on_making_percent)) == Decimal("18"):
        row.gst_on_making_percent = Decimal("5")
        row.save(update_fields=["gst_on_making_percent", "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0059_platform_gst_billing_rates"),
    ]

    operations = [
        migrations.RunPython(_set_india_making_gst_default, migrations.RunPython.noop),
    ]
