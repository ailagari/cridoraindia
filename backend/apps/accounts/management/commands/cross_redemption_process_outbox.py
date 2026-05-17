from django.core.management.base import BaseCommand

from apps.accounts.services.cross_redemption.outbox import process_pending_outbox


class Command(BaseCommand):
    help = "Process integration outbox rows (MVP: mark done without external calls)."

    def handle(self, *args, **options):
        n = process_pending_outbox(limit=200)
        self.stdout.write(self.style.SUCCESS(f"Processed {n} outbox row(s)."))
