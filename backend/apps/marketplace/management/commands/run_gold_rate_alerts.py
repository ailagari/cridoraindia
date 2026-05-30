from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Deprecated: live gold alerts are event-driven (GoldPriceUpdated on ticker ingest). "
        "Use ingest via spot refresh or admin ticker save. For manual replay only."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--replay",
            action="store_true",
            help="Force one ingest from current 22K reference (recovery only).",
        )

    def handle(self, *args, **options):
        if not options.get("replay"):
            self.stderr.write(
                self.style.WARNING(
                    "Skipped: run_gold_rate_alerts is not scheduled for live alerts. "
                    "Notifications run on gold price ingest (spot/ticker events)."
                )
            )
            return
        from apps.marketplace.gold_price_events import ingest_platform_gold_price
        from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

        base, src = resolve_cridora_base_22k_inr()
        out = ingest_platform_gold_price(base=base, source=f"replay:{src}")
        self.stdout.write(self.style.SUCCESS(str(out)))
