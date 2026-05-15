from django.core.management.base import BaseCommand

from apps.accounts.services.festival_broadcast import process_due_festival_broadcasts


class Command(BaseCommand):
    help = (
        "Send due scheduled festival / broadcast Web Push notifications. "
        "Schedule every few minutes on your host (e.g. Railway Cron): "
        "`python manage.py process_festival_broadcasts` from the backend dir with DATABASE_URL set."
    )

    def handle(self, *args, **options):
        n = process_due_festival_broadcasts()
        self.stdout.write(self.style.SUCCESS(f"Finalized {n} broadcast row(s)."))
