"""Idempotent saga steps, checkpoints, vault + liability + obligation."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from apps.accounts.models import (
    CrossRedemptionEvent,
    CrossRedemptionRequest,
    CrossRedemptionSagaStep,
    ExposureReservation,
    IntegrationOutbox,
    SettlementObligation,
)
from apps.accounts.jeweller_liability_service import (
    assume_custodial_liability_cross_redemption_destination,
    release_custodial_liability_cross_redemption_source,
    rollback_assume_custodial_liability_cross_redemption_destination,
    rollback_release_custodial_liability_cross_redemption_source,
)
from apps.accounts.vault_service import (
    credit_customer_vault_lines,
    debit_customer_vault_for_transfer,
    reverse_customer_vault_transfer_lines,
)
from apps.accounts.services.cross_redemption.constants import (
    ORDERED_FORWARD_STEPS,
    OUTBOX_CROSS_REDEMPTION_NOTIFY,
    STEP_LIABILITY_DEST_ASSUME,
    STEP_LIABILITY_SOURCE_RELEASE,
    STEP_OUTBOX_NOTIFY,
    STEP_SETTLEMENT_OBLIGATION,
    STEP_VAULT_TRANSFER,
)
from apps.accounts.services.cross_redemption.events import log_event
from apps.accounts.services.cross_redemption.exceptions import CrossRedemptionError


def _step_key(req_id: int, step: str, direction: str, seq: int) -> str:
    return f"cr:{req_id}:{step}:{direction}:{seq}"


def _get_or_create_step(
    req: CrossRedemptionRequest,
    step: str,
    direction: str,
    seq: int,
) -> CrossRedemptionSagaStep:
    key = _step_key(req.pk, step, direction, seq)
    row, _ = CrossRedemptionSagaStep.objects.get_or_create(
        idempotency_key=key,
        defaults={
            "request": req,
            "step_name": step,
            "direction": direction,
            "status": CrossRedemptionSagaStep.Status.PENDING,
        },
    )
    return row


def _checkpoint(req: CrossRedemptionRequest, step: str) -> None:
    CrossRedemptionRequest.objects.filter(pk=req.pk).update(
        checkpoint_seq=req.checkpoint_seq + 1,
        last_completed_step=step,
    )
    req.checkpoint_seq += 1
    req.last_completed_step = step


def _mark_forward_step_compensated(req: CrossRedemptionRequest, step_name: str) -> None:
    CrossRedemptionSagaStep.objects.filter(
        request=req,
        step_name=step_name,
        direction=CrossRedemptionSagaStep.Direction.FWD,
        status=CrossRedemptionSagaStep.Status.SUCCEEDED,
    ).update(status=CrossRedemptionSagaStep.Status.SKIPPED)


def compensate_saga_failure(req: CrossRedemptionRequest, *, reason: str) -> None:
    """Reverse succeeded steps (inverse order); then terminal-fail the request."""
    if (
        req.saga_status == CrossRedemptionRequest.SagaStatus.ABORTED
        and req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.CLOSED
    ):
        return

    req.saga_status = CrossRedemptionRequest.SagaStatus.COMPENSATING
    req.save(update_fields=["saga_status", "updated_at"])
    log_event(
        req,
        actor=CrossRedemptionEvent.Actor.SYSTEM,
        event_type="compensation_required",
        payload={"reason": reason},
    )

    succeeded = {
        s.step_name
        for s in CrossRedemptionSagaStep.objects.filter(
            request_id=req.pk,
            direction=CrossRedemptionSagaStep.Direction.FWD,
            status=CrossRedemptionSagaStep.Status.SUCCEEDED,
        )
    }
    user = req.user
    src = req.source_jeweller
    dst = req.destination_jeweller
    grams = req.grams
    rollback_errors: list[str] = []

    for step in reversed(ORDERED_FORWARD_STEPS):
        if step not in succeeded:
            continue
        try:
            if step == STEP_OUTBOX_NOTIFY:
                IntegrationOutbox.objects.filter(
                    idempotency_key=f"ob:cr:{req.pk}:{OUTBOX_CROSS_REDEMPTION_NOTIFY}",
                ).delete()
            elif step == STEP_SETTLEMENT_OBLIGATION:
                for ob in list(SettlementObligation.objects.filter(linked_requests=req)):
                    if ob.status == SettlementObligation.Status.PENDING:
                        ob.delete()
            elif step == STEP_LIABILITY_DEST_ASSUME:
                rollback_assume_custodial_liability_cross_redemption_destination(dst, user, grams, req)
            elif step == STEP_LIABILITY_SOURCE_RELEASE:
                rollback_release_custodial_liability_cross_redemption_source(src, user, grams, req)
            elif step == STEP_VAULT_TRANSFER:
                raw_lines = (req.metadata or {}).get("saga_vault_transfer_lines")
                if raw_lines:
                    lines = [(str(h), Decimal(str(g))) for h, g in raw_lines]
                    err = reverse_customer_vault_transfer_lines(user, src, dst, lines)
                    if err:
                        rollback_errors.append(f"vault:{err}")
                meta = dict(req.metadata or {})
                meta.pop("saga_vault_transfer_lines", None)
                CrossRedemptionRequest.objects.filter(pk=req.pk).update(metadata=meta)
                req.metadata = meta
            _mark_forward_step_compensated(req, step)
        except Exception as ex:
            rollback_errors.append(f"{step}:{ex!s}")

    if rollback_errors:
        log_event(
            req,
            actor=CrossRedemptionEvent.Actor.SYSTEM,
            event_type="compensation_partial",
            payload={"errors": rollback_errors},
        )

    req.lifecycle_stage = CrossRedemptionRequest.LifecycleStage.CLOSED
    req.outcome = CrossRedemptionRequest.Outcome.FAILURE
    req.close_reason_code = CrossRedemptionRequest.CloseReason.SYSTEM_KILL_SWITCH
    req.saga_status = CrossRedemptionRequest.SagaStatus.ABORTED
    req.save(
        update_fields=[
            "lifecycle_stage",
            "outcome",
            "close_reason_code",
            "saga_status",
            "updated_at",
        ]
    )
    ExposureReservation.objects.filter(request=req).update(
        status=ExposureReservation.Status.RELEASED,
    )


def run_forward_saga(req: CrossRedemptionRequest, *, lease_holder: str) -> None:
    """Assume row locks already held (request + policies + vault holdings)."""
    if req.saga_status == CrossRedemptionRequest.SagaStatus.COMMITTED:
        return
    if req.saga_status == CrossRedemptionRequest.SagaStatus.ABORTED:
        raise CrossRedemptionError("saga_aborted", "Saga aborted.")
    req.saga_status = CrossRedemptionRequest.SagaStatus.IN_PROGRESS
    req.lifecycle_stage = CrossRedemptionRequest.LifecycleStage.FULFILLMENT
    req.lease_holder = lease_holder
    req.lease_until = timezone.now() + timedelta(minutes=15)
    req.save(
        update_fields=[
            "saga_status",
            "lifecycle_stage",
            "lease_holder",
            "lease_until",
            "updated_at",
        ]
    )

    user = req.user
    src = req.source_jeweller
    dst = req.destination_jeweller
    grams = req.grams

    for i, step in enumerate(ORDERED_FORWARD_STEPS, start=1):
        row = _get_or_create_step(req, step, CrossRedemptionSagaStep.Direction.FWD, i)
        if row.status == CrossRedemptionSagaStep.Status.SUCCEEDED:
            continue
        try:
            if step == STEP_VAULT_TRANSFER:
                lines, err = debit_customer_vault_for_transfer(user, src, grams)
                if err:
                    raise CrossRedemptionError("vault_debit", err)
                credit_customer_vault_lines(user, dst, lines)
                meta = dict(req.metadata or {})
                meta["saga_vault_transfer_lines"] = [[h, str(g)] for h, g in lines]
                CrossRedemptionRequest.objects.filter(pk=req.pk).update(metadata=meta)
                req.metadata = meta
            elif step == STEP_LIABILITY_SOURCE_RELEASE:
                release_custodial_liability_cross_redemption_source(src, user, grams, req)
            elif step == STEP_LIABILITY_DEST_ASSUME:
                assume_custodial_liability_cross_redemption_destination(dst, user, grams, req)
            elif step == STEP_SETTLEMENT_OBLIGATION:
                if not req.settlement_obligations.exists():
                    ob = SettlementObligation.objects.create(
                        from_jeweller=src,
                        to_jeweller=dst,
                        amount_inr=req.estimated_value_snapshot_inr,
                        grams_equivalent=grams,
                        status=SettlementObligation.Status.PENDING,
                    )
                    ob.linked_requests.add(req)
            elif step == STEP_OUTBOX_NOTIFY:
                IntegrationOutbox.objects.get_or_create(
                    idempotency_key=f"ob:cr:{req.pk}:{OUTBOX_CROSS_REDEMPTION_NOTIFY}",
                    defaults={
                        "message_type": OUTBOX_CROSS_REDEMPTION_NOTIFY,
                        "payload": {"cross_redemption_request_id": req.pk},
                        "status": IntegrationOutbox.Status.PENDING,
                    },
                )
            else:
                raise CrossRedemptionError("unknown_step", step)
        except CrossRedemptionError as e:
            row.status = CrossRedemptionSagaStep.Status.FAILED
            row.error_detail = e.message[:500]
            row.save(update_fields=["status", "error_detail", "updated_at"])
            compensate_saga_failure(req, reason=e.message)
            raise
        except Exception as e:
            row.status = CrossRedemptionSagaStep.Status.FAILED
            row.error_detail = str(e)[:500]
            row.save(update_fields=["status", "error_detail", "updated_at"])
            compensate_saga_failure(req, reason=str(e))
            raise CrossRedemptionError("step_failed", str(e)) from e

        row.status = CrossRedemptionSagaStep.Status.SUCCEEDED
        row.save(update_fields=["status", "updated_at"])
        _checkpoint(req, step)

    req.lifecycle_stage = CrossRedemptionRequest.LifecycleStage.SETTLEMENT
    req.workflow_state = CrossRedemptionRequest.WorkflowState.SAGA_DONE
    req.saga_status = CrossRedemptionRequest.SagaStatus.COMMITTED
    req.fulfillment_committed_at = timezone.now()
    req.save(
        update_fields=[
            "lifecycle_stage",
            "workflow_state",
            "saga_status",
            "fulfillment_committed_at",
            "updated_at",
        ]
    )
    ExposureReservation.objects.filter(request=req).update(
        status=ExposureReservation.Status.CONSUMED,
    )
    meta = dict(req.metadata or {})
    meta.pop("saga_vault_transfer_lines", None)
    CrossRedemptionRequest.objects.filter(pk=req.pk).update(metadata=meta)
    log_event(
        req,
        actor=CrossRedemptionEvent.Actor.SYSTEM,
        event_type="saga_committed",
        payload={"checkpoint_seq": req.checkpoint_seq},
    )
