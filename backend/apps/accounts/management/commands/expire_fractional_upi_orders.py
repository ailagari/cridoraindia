"""Cancel fractional UPI orders past payment_expires_at."""

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import FractionalGoldPurchase


class Command(BaseCommand):
    help = "Cancel pending fractional UPI orders after payment window expires."

    def handle(self, *args, **options):
        now = timezone.now()
        qs = FractionalGoldPurchase.objects.filter(
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status=FractionalGoldPurchase.PENDING_PAYMENT,
            payment_expires_at__lt=now,
        )
        count = qs.update(status=FractionalGoldPurchase.CANCELLED)
        self.stdout.write(self.style.SUCCESS(f"Cancelled {count} expired UPI order(s)."))
