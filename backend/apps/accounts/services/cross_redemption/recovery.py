"""Replay-based recovery: resume saga from checkpoints + saga step log only."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import CrossRedemptionRequest
from apps.accounts.services.cross_redemption.locks import (
    acquire_request_and_policies,
    lock_vault_holdings_for_customer,
    sorted_jeweller_pair,
)
from apps.accounts.services.cross_redemption.saga import run_forward_saga


def recover_forward_saga(request_id: int, *, lease_holder: str) -> str:
    """
    Re-enter forward saga when:
    - workflow is SAGA_PENDING (crash after flag, before executor), or
    - fulfillment is IN_PROGRESS with an expired lease (worker takeover).

    Returns a short status token for logging.
    """
    req_ref = CrossRedemptionRequest.objects.filter(pk=request_id).first()
    if not req_ref:
        return "not_found"
    ja, jb = sorted_jeweller_pair(req_ref.source_jeweller_id, req_ref.destination_jeweller_id)
    now = timezone.now()
    with transaction.atomic():
        req, _ = acquire_request_and_policies(request_id, ja, jb, skip_locked=False)
        if req is None:
            return "lock_busy"
        if req.saga_status == CrossRedemptionRequest.SagaStatus.COMMITTED:
            return "already_committed"
        if req.saga_status == CrossRedemptionRequest.SagaStatus.ABORTED:
            return "aborted"
        if req.workflow_state == CrossRedemptionRequest.WorkflowState.SAGA_PENDING:
            lock_vault_holdings_for_customer(req.user_id, req.source_jeweller_id, req.destination_jeweller_id)
            run_forward_saga(req, lease_holder=lease_holder)
            return "recovered_saga_pending"
        if (
            req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.FULFILLMENT
            and req.saga_status == CrossRedemptionRequest.SagaStatus.IN_PROGRESS
        ):
            if req.lease_until and req.lease_until > now:
                return "lease_active"
            lock_vault_holdings_for_customer(req.user_id, req.source_jeweller_id, req.destination_jeweller_id)
            run_forward_saga(req, lease_holder=lease_holder)
            return "recovered_expired_lease"
        return "noop"
