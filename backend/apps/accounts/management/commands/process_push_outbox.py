from django.core.management.base import BaseCommand

from apps.accounts.services.notification_push_queue import process_pending_push_outbox


class Command(BaseCommand):
    help = "Drain pending durable push outbox rows (retries + backlog)."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=200)

    def handle(self, *args, **options):
        n = process_pending_push_outbox(limit=int(options["limit"]))
        self.stdout.write(self.style.SUCCESS(f"Push outbox sent: {n}"))
