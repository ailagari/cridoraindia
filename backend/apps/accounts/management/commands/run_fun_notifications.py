"""Optional fun/time-of-day notifications when enabled on platform ticker."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.models import PortfolioUserNotification
from apps.accounts.services.inbox_notify import notify_inbox
from apps.accounts.services.notification_rate_limits import fun_notification_allowed, record_fun_notification
from apps.marketplace.models import get_or_create_ticker

User = get_user_model()

MESSAGES = [
    ("Morning check", "Today's gold valuations are updated in Cridora."),
    ("Evening tea", "Gold rates refreshed — portfolio nokkikko when you have a moment."),
]


class Command(BaseCommand):
    help = "Send at most one fun notification per eligible customer (platform flag)."

    def handle(self, *args, **options):
        ticker = get_or_create_ticker()
        if not ticker.enable_fun_notifications:
            self.stdout.write("Fun notifications disabled on ticker config.")
            return
        title, body = MESSAGES[0]
        sent = 0
        for user in User.objects.filter(user_type=User.CUSTOMER, is_active=True).iterator(
            chunk_size=200
        ):
            if not fun_notification_allowed(user.pk):
                continue
            notify_inbox(
                user,
                kind=PortfolioUserNotification.KIND_SYSTEM,
                title=title,
                body=body,
                link_path="/userdashboard?section=portfolio_overview",
                category=PortfolioUserNotification.CATEGORY_PROMO,
                priority=PortfolioUserNotification.PRIORITY_LOW,
                tag="fun-digest",
            )
            record_fun_notification(user.pk)
            sent += 1
        self.stdout.write(self.style.SUCCESS(f"Fun notifications sent: {sent}"))
