"""Settlement payment confirm/reject helpers."""

from __future__ import annotations

from datetime import date

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import (
    PlatformCommercialLedgerEntry,
    PlatformSettlementBatch,
    PlatformSettlementPayment,
)

User = get_user_model()


def _settle_entries_for_payment(payment: PlatformSettlementPayment) -> None:
    if payment.settlement_batch_id:
        batch = PlatformSettlementBatch.objects.select_for_update().get(pk=payment.settlement_batch_id)
        PlatformCommercialLedgerEntry.objects.filter(
            settlement_batch_id=batch.pk,
            status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
        ).update(status=PlatformCommercialLedgerEntry.STATUS_SETTLED)
        batch.settled_at = timezone.now()
        batch.save(update_fields=["settled_at"])
        return

    remaining = payment.amount_inr
    entries = (
        PlatformCommercialLedgerEntry.objects.select_for_update()
        .filter(
            jeweller_id=payment.jeweller_id,
            status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
        )
        .order_by("created_at")
    )
    for e in entries:
        if remaining <= 0:
            break
        e.status = PlatformCommercialLedgerEntry.STATUS_SETTLED
        e.save(update_fields=["status"])
        remaining -= e.amount_inr


def confirm_settlement_payment(payment: PlatformSettlementPayment, admin: User) -> None:
    with transaction.atomic():
        payment.status = PlatformSettlementPayment.STATUS_CONFIRMED
        payment.confirmed_by = admin
        payment.confirmed_at = timezone.now()
        payment.save(update_fields=["status", "confirmed_by", "confirmed_at"])
        _settle_entries_for_payment(payment)


def reject_settlement_payment(payment: PlatformSettlementPayment, admin: User, reason: str) -> None:
    payment.status = PlatformSettlementPayment.STATUS_REJECTED
    payment.confirmed_by = admin
    payment.confirmed_at = timezone.now()
    payment.rejection_reason = (reason or "")[:512]
    payment.save(update_fields=["status", "confirmed_by", "confirmed_at", "rejection_reason"])


def serialize_settlement_payment(p: PlatformSettlementPayment) -> dict:
    jeweller = p.jeweller
    return {
        "id": p.pk,
        "direction": p.direction,
        "jeweller_id": p.jeweller_id,
        "jeweller_name": jeweller.business_name or jeweller.email or "",
        "settlement_batch_id": p.settlement_batch_id,
        "amount_inr": str(p.amount_inr),
        "status": p.status,
        "reference_note": p.reference_note or "",
        "utr": p.utr or "",
        "has_receipt": bool(p.receipt_file),
        "receipt_url": p.receipt_file.url if p.receipt_file else "",
        "paid_by_id": p.paid_by_id,
        "confirmed_by_id": p.confirmed_by_id,
        "confirmed_at": p.confirmed_at.isoformat() if p.confirmed_at else None,
        "rejection_reason": p.rejection_reason or "",
        "created_at": p.created_at.isoformat(),
    }
