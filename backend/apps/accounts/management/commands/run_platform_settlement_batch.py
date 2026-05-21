"""Aggregate pending platform spread fees into settlement batches per jeweller."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import PlatformCommercialLedgerEntry, PlatformSettlementBatch

User = get_user_model()


class Command(BaseCommand):
    help = "Create platform settlement batches from pending spread_fee entries."

    def add_arguments(self, parser):
        parser.add_argument(
            "--period",
            default="",
            help="Period label (default: YYYY-MM-DD)",
        )

    def handle(self, *args, **options):
        period = (options.get("period") or "").strip()
        if not period:
            period = timezone.now().date().isoformat()
        jeweller_ids = (
            PlatformCommercialLedgerEntry.objects.filter(
                status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
                kind=PlatformCommercialLedgerEntry.KIND_SPREAD_FEE,
            )
            .values_list("jeweller_id", flat=True)
            .distinct()
        )
        created = 0
        for jid in jeweller_ids:
            entries = PlatformCommercialLedgerEntry.objects.filter(
                jeweller_id=jid,
                status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
                kind=PlatformCommercialLedgerEntry.KIND_SPREAD_FEE,
                settlement_batch__isnull=True,
            )
            total = entries.aggregate(t=Sum("amount_inr"))["t"] or Decimal("0")
            if total <= 0:
                continue
            jeweller = User.objects.filter(pk=jid, user_type=User.JEWELLER).first()
            if not jeweller:
                continue
            batch = PlatformSettlementBatch.objects.create(
                jeweller=jeweller,
                period_label=period,
                net_payable_inr=total.quantize(Decimal("0.01")),
            )
            entries.update(settlement_batch=batch)
            created += 1
        self.stdout.write(
            self.style.SUCCESS(f"Created {created} settlement batch(es) for period {period}.")
        )
