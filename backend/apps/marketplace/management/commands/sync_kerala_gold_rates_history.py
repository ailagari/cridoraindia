from django.core.management.base import BaseCommand

from apps.marketplace.goodreturns_kerala_rates import backfill_kerala_rates_from_goodreturns
from apps.marketplace.kerala_board_history import _maybe_prune_old_rows


class Command(BaseCommand):
    help = "Backfill up to 2 years of Kerala gold/silver daily rates from Goodreturns into the database."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=730, help="Calendar days to cover (max 730).")
        parser.add_argument(
            "--max-fetch",
            type=int,
            default=750,
            help="Maximum number of missing dates to fetch this run.",
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=0.15,
            help="Seconds between Goodreturns requests.",
        )

    def handle(self, *args, **options):
        stats = backfill_kerala_rates_from_goodreturns(
            days=options["days"],
            max_fetch=options["max_fetch"],
            sleep_sec=options["sleep"],
        )
        _maybe_prune_old_rows()
        self.stdout.write(self.style.SUCCESS(f"Kerala history backfill complete: {stats}"))
