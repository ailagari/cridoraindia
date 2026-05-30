from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Deprecated: hourly digest is evaluated on GoldPriceUpdated ingest. "
        "Use --replay for a one-off manual broadcast from current reference."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--replay",
            action="store_true",
            help="Run hourly digest evaluation once (recovery only).",
        )

    def handle(self, *args, **options):
        if not options.get("replay"):
            self.stderr.write(
                self.style.WARNING(
                    "Skipped: run_hourly_gold_push is not for Railway cron. "
                    "Hourly digest runs when platform price is ingested and ≥1h elapsed."
                )
            )
            return
        from apps.marketplace.gold_hourly_push import run_hourly_gold_price_push_digest

        out = run_hourly_gold_price_push_digest(force=True)
        self.stdout.write(self.style.SUCCESS(str(out)))
