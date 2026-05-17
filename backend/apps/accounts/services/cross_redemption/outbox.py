"""Process integration outbox rows (no external I/O in MVP — marks delivered locally)."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import IntegrationOutbox


def process_pending_outbox(*, limit: int = 50) -> int:
    """Atomically claim and complete pending rows (stub success)."""
    processed = 0
    ids = list(
        IntegrationOutbox.objects.filter(status=IntegrationOutbox.Status.PENDING)
        .order_by("id")
        .values_list("id", flat=True)[:limit]
    )
    for pk in ids:
        with transaction.atomic():
            row = (
                IntegrationOutbox.objects.select_for_update()
                .filter(pk=pk, status=IntegrationOutbox.Status.PENDING)
                .first()
            )
            if not row:
                continue
            row.status = IntegrationOutbox.Status.PROCESSING
            row.save(update_fields=["status", "updated_at"])
            row.status = IntegrationOutbox.Status.DONE
            row.available_at = timezone.now()
            row.save(update_fields=["status", "available_at", "updated_at"])
            processed += 1
    return processed
