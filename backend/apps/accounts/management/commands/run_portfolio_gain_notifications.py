"""Notify customers when portfolio value gain crosses platform thresholds."""

from django.core.management.base import BaseCommand

from apps.accounts.services.portfolio_gain_notify import run_portfolio_gain_notifications


class Command(BaseCommand):
    help = "Send portfolio gain inbox notifications when thresholds are exceeded (deduped)."

    def handle(self, *args, **options):
        out = run_portfolio_gain_notifications()
        self.stdout.write(
            self.style.SUCCESS(
                f"Portfolio gain notifications sent: {out.get('sent', 0)} (skipped {out.get('skipped', 0)})"
            )
        )
