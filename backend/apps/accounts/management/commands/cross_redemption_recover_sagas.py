from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import CrossRedemptionRequest
from apps.accounts.services.cross_redemption.recovery import recover_forward_saga


class Command(BaseCommand):
    help = (
        "Replay stuck cross-redemption sagas from checkpoints (SAGA_PENDING or expired fulfillment lease)."
    )

    def handle(self, *args, **options):
        now = timezone.now()
        qs = (
            CrossRedemptionRequest.objects.filter(
                Q(workflow_state=CrossRedemptionRequest.WorkflowState.SAGA_PENDING)
                | Q(
                    lifecycle_stage=CrossRedemptionRequest.LifecycleStage.FULFILLMENT,
                    saga_status=CrossRedemptionRequest.SagaStatus.IN_PROGRESS,
                    lease_until__lt=now,
                )
            )
            .exclude(lifecycle_stage=CrossRedemptionRequest.LifecycleStage.CLOSED)
            .exclude(saga_status=CrossRedemptionRequest.SagaStatus.COMMITTED)
            .exclude(saga_status=CrossRedemptionRequest.SagaStatus.ABORTED)
            .order_by("id")[:200]
        )
        for req in qs:
            status = recover_forward_saga(req.pk, lease_holder="worker:recover")
            if status not in ("noop", "lease_active", "already_committed", "aborted"):
                self.stdout.write(f"request={req.pk} -> {status}")
        self.stdout.write(self.style.SUCCESS("Cross-redemption recovery pass complete."))
