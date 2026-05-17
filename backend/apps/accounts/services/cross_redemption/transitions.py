"""Single entry for workflow mutations (+ saga invoke)."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import CrossRedemptionEvent, CrossRedemptionRequest, ExposureReservation, JewellerCrossPolicy
from apps.accounts.services.cross_redemption.authorization import _DEFAULT_POLICY
from apps.accounts.services.cross_redemption.events import log_event
from apps.accounts.services.cross_redemption.exceptions import CrossRedemptionError
from apps.accounts.services.cross_redemption.locks import acquire_request_and_policies, lock_vault_holdings_for_customer, sorted_jeweller_pair
from apps.accounts.services.cross_redemption.saga import compensate_saga_failure, run_forward_saga

User = get_user_model()

DEST_ACCEPT = "dest_accept"
DEST_REJECT = "dest_reject"
SOURCE_APPROVE = "source_approve"
SOURCE_REJECT = "source_reject"
USER_CANCEL = "user_cancel"
SYSTEM_TIMEOUT = "system_timeout"
SETTLEMENT_COMPLETE = "settlement_complete"
FULFILLMENT_HEARTBEAT = "fulfillment_heartbeat"
RISK_BLOCK_CLOSE = "risk_block_close"


def _close_failure(req: CrossRedemptionRequest, reason: str) -> None:
    req.lifecycle_stage = CrossRedemptionRequest.LifecycleStage.CLOSED
    req.outcome = CrossRedemptionRequest.Outcome.FAILURE
    req.close_reason_code = reason
    req.save(
        update_fields=[
            "lifecycle_stage",
            "outcome",
            "close_reason_code",
            "updated_at",
        ]
    )
    ExposureReservation.objects.filter(request=req).update(status=ExposureReservation.Status.RELEASED)


def transition_request(
    request_id: int,
    action: str,
    actor_user: User | None = None,
    *,
    lease_holder: str = "",
    skip_locked: bool = False,
) -> CrossRedemptionRequest:
    if action not in (SYSTEM_TIMEOUT,) and actor_user is None:
        raise CrossRedemptionError("actor_required", "Actor required for this action.")

    req_ref = CrossRedemptionRequest.objects.filter(pk=request_id).first()
    if not req_ref:
        raise CrossRedemptionError("not_found", "Request not found.")
    ja, jb = sorted_jeweller_pair(req_ref.source_jeweller_id, req_ref.destination_jeweller_id)

    with transaction.atomic():
        req, _policies = acquire_request_and_policies(request_id, ja, jb, skip_locked=skip_locked)
        if req is None:
            raise CrossRedemptionError("lock_busy", "Request lock unavailable.")
        if req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.CLOSED:
            return req
        if action == USER_CANCEL:
            assert actor_user is not None
            if actor_user.id != req.user_id:
                raise CrossRedemptionError("forbidden", "Not your request.")
            if req.lifecycle_stage != CrossRedemptionRequest.LifecycleStage.AUTH:
                raise CrossRedemptionError("invalid_state", "Cannot cancel at this stage.")
            _close_failure(req, CrossRedemptionRequest.CloseReason.USER_CANCEL)
            log_event(req, actor=CrossRedemptionEvent.Actor.USER, event_type="user_cancel", payload={})
            return req
        if action == DEST_REJECT:
            assert actor_user is not None
            if actor_user.id != req.destination_jeweller_id:
                raise CrossRedemptionError("forbidden", "Destination jeweller only.")
            if req.workflow_state != CrossRedemptionRequest.WorkflowState.AWAITING_DESTINATION:
                raise CrossRedemptionError("invalid_state", "Invalid workflow state.")
            _close_failure(req, CrossRedemptionRequest.CloseReason.REJECT)
            log_event(req, actor=CrossRedemptionEvent.Actor.JEWELLER_DEST, event_type="dest_reject", payload={})
            return req
        if action == SOURCE_REJECT:
            assert actor_user is not None
            if actor_user.id != req.source_jeweller_id:
                raise CrossRedemptionError("forbidden", "Source jeweller only.")
            if req.workflow_state != CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE:
                raise CrossRedemptionError("invalid_state", "Invalid workflow state.")
            _close_failure(req, CrossRedemptionRequest.CloseReason.REJECT)
            log_event(req, actor=CrossRedemptionEvent.Actor.JEWELLER_SOURCE, event_type="source_reject", payload={})
            return req
        if action == SYSTEM_TIMEOUT:
            now = timezone.now()
            if req.saga_status == CrossRedemptionRequest.SagaStatus.COMMITTED:
                return req
            if req.lifecycle_stage in (
                CrossRedemptionRequest.LifecycleStage.FULFILLMENT,
                CrossRedemptionRequest.LifecycleStage.SETTLEMENT,
            ):
                return req
            if not req.deadline_at or now <= req.deadline_at:
                return req
            if req.workflow_state == CrossRedemptionRequest.WorkflowState.SAGA_PENDING:
                return req
            if req.lifecycle_stage != CrossRedemptionRequest.LifecycleStage.AUTH:
                return req
            _close_failure(req, CrossRedemptionRequest.CloseReason.TIMEOUT)
            log_event(req, actor=CrossRedemptionEvent.Actor.SYSTEM, event_type="timeout_release", payload={})
            return req
        if action == FULFILLMENT_HEARTBEAT:
            assert actor_user is not None
            if actor_user.id not in (req.source_jeweller_id, req.destination_jeweller_id):
                raise CrossRedemptionError("forbidden", "Jeweller party only.")
            if (
                req.lifecycle_stage != CrossRedemptionRequest.LifecycleStage.FULFILLMENT
                or req.saga_status != CrossRedemptionRequest.SagaStatus.IN_PROGRESS
            ):
                raise CrossRedemptionError("invalid_state", "No active fulfillment lease.")
            holder = (lease_holder or "").strip()
            if not holder:
                raise CrossRedemptionError("lease_holder_required", "lease_holder is required.")
            if holder != (req.lease_holder or "").strip():
                raise CrossRedemptionError("lease_holder_mismatch", "Lease holder does not match.")
            req.lease_until = timezone.now() + timedelta(minutes=15)
            req.save(update_fields=["lease_until", "updated_at"])
            actor = (
                CrossRedemptionEvent.Actor.JEWELLER_SOURCE
                if actor_user.id == req.source_jeweller_id
                else CrossRedemptionEvent.Actor.JEWELLER_DEST
            )
            log_event(
                req,
                actor=actor,
                event_type="fulfillment_heartbeat",
                payload={"until": req.lease_until.isoformat()},
            )
            return req
        if action == RISK_BLOCK_CLOSE:
            assert actor_user is not None
            if not actor_user.is_staff:
                raise CrossRedemptionError("forbidden", "Staff only.")
            if req.saga_status == CrossRedemptionRequest.SagaStatus.COMMITTED:
                raise CrossRedemptionError("invalid_state", "Cannot risk-block after fulfillment commit.")
            if req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.CLOSED:
                return req
            needs_compensation = (
                req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.FULFILLMENT
                or req.saga_status
                in (
                    CrossRedemptionRequest.SagaStatus.IN_PROGRESS,
                    CrossRedemptionRequest.SagaStatus.COMPENSATING,
                )
                or req.workflow_state == CrossRedemptionRequest.WorkflowState.SAGA_PENDING
            )
            if needs_compensation:
                compensate_saga_failure(req, reason="admin_risk_block")
                CrossRedemptionRequest.objects.filter(pk=req.pk).update(
                    close_reason_code=CrossRedemptionRequest.CloseReason.RISK_BLOCK
                )
                log_event(
                    req,
                    actor=CrossRedemptionEvent.Actor.ADMIN,
                    event_type="risk_block_close",
                    payload={"compensated": True},
                )
            else:
                _close_failure(req, CrossRedemptionRequest.CloseReason.RISK_BLOCK)
                log_event(
                    req,
                    actor=CrossRedemptionEvent.Actor.ADMIN,
                    event_type="risk_block_close",
                    payload={},
                )
            return CrossRedemptionRequest.objects.get(pk=req.pk)
        if action == SETTLEMENT_COMPLETE:
            assert actor_user is not None
            if not actor_user.is_staff:
                raise CrossRedemptionError("forbidden", "Staff only.")
            if req.lifecycle_stage != CrossRedemptionRequest.LifecycleStage.SETTLEMENT:
                raise CrossRedemptionError("invalid_state", "Request not in settlement.")
            if req.saga_status != CrossRedemptionRequest.SagaStatus.COMMITTED:
                raise CrossRedemptionError("invalid_state", "Fulfillment not committed.")
            req.lifecycle_stage = CrossRedemptionRequest.LifecycleStage.CLOSED
            req.outcome = CrossRedemptionRequest.Outcome.SUCCESS
            req.save(update_fields=["lifecycle_stage", "outcome", "updated_at"])
            log_event(
                req,
                actor=CrossRedemptionEvent.Actor.ADMIN,
                event_type="settlement_completed_mvp",
                payload={},
            )
            return req
        if action == DEST_ACCEPT:
            assert actor_user is not None
            if actor_user.id != req.destination_jeweller_id:
                raise CrossRedemptionError("forbidden", "Destination jeweller only.")
            if req.workflow_state != CrossRedemptionRequest.WorkflowState.AWAITING_DESTINATION:
                raise CrossRedemptionError("invalid_state", "Invalid workflow state.")
            pol, _ = JewellerCrossPolicy.objects.get_or_create(
                jeweller_id=req.source_jeweller_id,
                defaults=_DEFAULT_POLICY.copy(),
            )
            if pol.require_source_approval:
                req.workflow_state = CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE
                req.save(update_fields=["workflow_state", "updated_at"])
                log_event(
                    req,
                    actor=CrossRedemptionEvent.Actor.JEWELLER_DEST,
                    event_type="dest_accept_pending_source",
                    payload={},
                )
                return req
            req.workflow_state = CrossRedemptionRequest.WorkflowState.SAGA_PENDING
            req.save(update_fields=["workflow_state", "updated_at"])
            log_event(req, actor=CrossRedemptionEvent.Actor.JEWELLER_DEST, event_type="dest_accept", payload={})
            lock_vault_holdings_for_customer(req.user_id, req.source_jeweller_id, req.destination_jeweller_id)
            run_forward_saga(req, lease_holder=lease_holder or f"dest:{actor_user.id}")
            return req
        if action == SOURCE_APPROVE:
            assert actor_user is not None
            if actor_user.id != req.source_jeweller_id:
                raise CrossRedemptionError("forbidden", "Source jeweller only.")
            if req.workflow_state != CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE:
                raise CrossRedemptionError("invalid_state", "Invalid workflow state.")
            req.workflow_state = CrossRedemptionRequest.WorkflowState.SAGA_PENDING
            req.save(update_fields=["workflow_state", "updated_at"])
            log_event(req, actor=CrossRedemptionEvent.Actor.JEWELLER_SOURCE, event_type="source_approve", payload={})
            lock_vault_holdings_for_customer(req.user_id, req.source_jeweller_id, req.destination_jeweller_id)
            run_forward_saga(req, lease_holder=lease_holder or f"src:{actor_user.id}")
            return req
        raise CrossRedemptionError("unknown_action", action)
