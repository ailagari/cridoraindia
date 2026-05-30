"""Evaluate portfolio gain alerts (normally triggered by GoldPriceUpdated ingest)."""

from django.core.management.base import BaseCommand

from apps.accounts.services.portfolio_gain_notify import evaluate_portfolio_gains_after_rate_change


class Command(BaseCommand):
    help = (
        "Manual replay of portfolio gain rules. Live market alerts run on gold price ingest, "
        "not Railway cron. Use for housekeeping/replay only."
    )

    def handle(self, *args, **options):
        out = evaluate_portfolio_gains_after_rate_change(defer_push=False)
        self.stdout.write(
            self.style.SUCCESS(
                f"Portfolio gain notifications sent: {out.get('sent', 0)} (skipped {out.get('skipped', 0)})"
            )
        )
