from django.core.management.base import BaseCommand

from apps.marketplace.gold_rate_alerts import maybe_notify_gold_rate_move


class Command(BaseCommand):
    help = (
        "Check public 22K reference vs baseline and send threshold push alerts when configured. "
        "Schedule every 1–5 minutes on Railway Cron, e.g. "
        "`python manage.py run_gold_rate_alerts` from /app/backend with DATABASE_URL set."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Bypass the short cache lock (admin testing).",
        )

    def handle(self, *args, **options):
        out = maybe_notify_gold_rate_move(force=bool(options.get("force")))
        self.stdout.write(self.style.SUCCESS(str(out)))
