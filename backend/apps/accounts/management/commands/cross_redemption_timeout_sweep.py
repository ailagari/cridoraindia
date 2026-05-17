from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import CrossRedemptionRequest
from apps.accounts.services.cross_redemption.exceptions import CrossRedemptionError
from apps.accounts.services.cross_redemption.transitions import SYSTEM_TIMEOUT, transition_request


class Command(BaseCommand):
    help = "Close AUTH-stage cross-redemption requests past deadline (skip_locked; recovery handles SAGA_PENDING)."

    def handle(self, *args, **options):
        now = timezone.now()
        rows = list(
            CrossRedemptionRequest.objects.filter(
                lifecycle_stage=CrossRedemptionRequest.LifecycleStage.AUTH,
                deadline_at__lt=now,
            )
            .exclude(workflow_state=CrossRedemptionRequest.WorkflowState.SAGA_PENDING)
            .order_by("id")[:500]
        )
        closed = 0
        skipped = 0
        for req in rows:
            try:
                transition_request(req.pk, SYSTEM_TIMEOUT, None, skip_locked=True)
                closed += 1
            except CrossRedemptionError as e:
                if e.code == "lock_busy":
                    skipped += 1
                    continue
                raise
        self.stdout.write(
            self.style.SUCCESS(
                f"Cross-redemption timeout sweep: attempted={len(rows)}, closed~={closed}, lock_busy={skipped}."
            )
        )
