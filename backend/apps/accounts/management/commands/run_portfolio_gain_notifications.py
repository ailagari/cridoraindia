"""Notify customers when portfolio value gain crosses platform thresholds."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.models import PortfolioUserNotification
from apps.accounts.services.inbox_notify import notify_inbox
from apps.accounts.services.personal_holdings import customer_portfolio_totals_payload
from apps.marketplace.models import get_or_create_ticker

User = get_user_model()


class Command(BaseCommand):
    help = "Send portfolio gain inbox notifications when thresholds are exceeded."

    def handle(self, *args, **options):
        ticker = get_or_create_ticker()
        threshold_inr = ticker.portfolio_gain_threshold_inr or Decimal("500")
        threshold_pct = ticker.portfolio_gain_threshold_percent or Decimal("2")
        sent = 0
        for user in User.objects.filter(user_type=User.CUSTOMER, is_active=True).iterator(
            chunk_size=200
        ):
            totals = customer_portfolio_totals_payload(user)
            gain_inr = Decimal(str(totals.get("personal_gain_on_recorded_cost_inr") or "0"))
            gain_pct = Decimal(str(totals.get("personal_gain_on_recorded_cost_percent") or "0"))
            if gain_inr < threshold_inr and gain_pct < threshold_pct:
                continue
            gain_s = format(gain_inr, "f").rstrip("0").rstrip(".")
            notify_inbox(
                user,
                kind=PortfolioUserNotification.KIND_SYSTEM,
                title="Portfolio value update",
                body=f"Your gold portfolio gained an estimated ₹{gain_s} in value.",
                link_path="/userdashboard?section=portfolio_overview",
                category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
                priority=PortfolioUserNotification.PRIORITY_LOW,
                tag=f"port-gain-{user.pk}",
            )
            sent += 1
        self.stdout.write(self.style.SUCCESS(f"Portfolio gain notifications sent: {sent}"))
