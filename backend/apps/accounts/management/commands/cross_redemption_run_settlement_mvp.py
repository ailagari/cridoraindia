from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.models import CrossRedemptionRequest, SettlementObligation
from apps.accounts.services.cross_redemption.exceptions import CrossRedemptionError
from apps.accounts.services.cross_redemption.transitions import SETTLEMENT_COMPLETE, transition_request

User = get_user_model()


class Command(BaseCommand):
    help = "MVP: mark settlement obligations settled and close COMMITTED cross-redemption rows (staff actor)."

    def handle(self, *args, **options):
        actor = User.objects.filter(is_staff=True).order_by("id").first()
        if not actor:
            self.stdout.write(self.style.ERROR("No staff user; create one first."))
            return
        updated = SettlementObligation.objects.filter(status=SettlementObligation.Status.PENDING).update(
            status=SettlementObligation.Status.SETTLED
        )
        rows = list(
            CrossRedemptionRequest.objects.filter(
                lifecycle_stage=CrossRedemptionRequest.LifecycleStage.SETTLEMENT,
                saga_status=CrossRedemptionRequest.SagaStatus.COMMITTED,
            ).order_by("id")
        )
        closed = 0
        skipped = 0
        for req in rows:
            try:
                transition_request(req.pk, SETTLEMENT_COMPLETE, actor, skip_locked=False)
                closed += 1
            except CrossRedemptionError as e:
                if e.code == "lock_busy":
                    skipped += 1
                    continue
                raise
        self.stdout.write(
            self.style.SUCCESS(
                f"Obligations marked settled={updated}, requests closed={closed}, lock_busy={skipped}."
            )
        )
