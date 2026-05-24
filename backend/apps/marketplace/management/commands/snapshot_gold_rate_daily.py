from django.core.management.base import BaseCommand

from apps.marketplace.gold_rate_daily_snapshot import run_daily_gold_rate_maintenance
from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr


class Command(BaseCommand):
    help = (
        "Capture today's 22K gold reference OHLC, backfill missing daily rows from intraday "
        "samples, and prune entries older than one year. "
        "Schedule daily on Railway Cron (e.g. 18:30 IST): "
        "`python manage.py snapshot_gold_rate_daily` from /app/backend."
    )

    def handle(self, *args, **options):
        base, src = resolve_cridora_base_22k_inr()
        out = run_daily_gold_rate_maintenance(price=base, source=src)
        self.stdout.write(str(out))
