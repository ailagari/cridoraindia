from django.core.management.base import BaseCommand

from apps.marketplace.gold_price_poll import maybe_poll_platform_gold_for_alerts
from apps.marketplace.spot_prices import refresh_live_kerala_feed


class Command(BaseCommand):
    help = (
        "Poll AKGSMA / Jos / Goodreturns, refresh cached Kerala board rates, "
        "and ingest the platform 22K reference so automatic rate-move pushes can fire."
    )

    def handle(self, *args, **options):
        payload = refresh_live_kerala_feed(force_fetch=True)
        if payload is None or not isinstance(payload.get("gold"), dict):
            self.stdout.write(self.style.WARNING("Kerala board refresh: no 22K rate available."))
            return
        gold = payload["gold"]
        self.stdout.write(
            self.style.SUCCESS(
                f"Kerala board refreshed — source={payload.get('source')} "
                f"22K={gold.get('22K')} 18K={gold.get('18K')} 24K={gold.get('24K')} "
                f"silver999={(payload.get('silver') or {}).get('999')}"
            )
        )
        ingest = maybe_poll_platform_gold_for_alerts(force=True)
        self.stdout.write(self.style.SUCCESS(f"Gold alert ingest: {ingest}"))
