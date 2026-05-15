from django.core.management.base import BaseCommand

from apps.marketplace.gold_hourly_push import run_hourly_gold_price_push_digest


class Command(BaseCommand):
    help = (
        "Broadcast hourly gold 22K reference Web Push vs prior snapshot. "
        "Schedule every hour on your host (e.g. Railway Cron): "
        "`python manage.py run_hourly_gold_push` from /app/backend with DATABASE_URL set."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Bypass the short duplicate-run lock (for manual retries).",
        )

    def handle(self, *args, **options):
        out = run_hourly_gold_price_push_digest(force=bool(options.get("force")))
        self.stdout.write(str(out))
