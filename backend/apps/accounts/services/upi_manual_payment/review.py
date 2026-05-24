"""Approve, reject, and fraud-report UPI proofs."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import UpiFraudReport, UpiPaymentProofSubmission
from apps.accounts.services.upi_manual_payment.payload import serialize_upi_state
from apps.accounts.services.upi_manual_payment.registry import (
    content_type_for,
    get_completion_fn,
    get_spec,
    user_can_reviewer,
)

User = get_user_model()


def approve_payment(kind: str, entity: Any, user: User) -> tuple[dict | None, str | None]:
    spec = get_spec(kind)
    if not user_can_reviewer(user, kind, entity):
        return None, "Not allowed to approve this payment."
    if entity.status != spec.pending_review_status:
        return None, "Payment is not awaiting review."

    with transaction.atomic():
        locked = spec.model.objects.select_for_update().get(pk=entity.pk)
        if locked.status != spec.pending_review_status:
            return None, "Payment is not awaiting review."
        complete_fn = get_completion_fn(kind)
        ok, detail = complete_fn(locked, user)
        if not ok:
            return None, detail

    locked.refresh_from_db()
    return serialize_upi_state(kind, locked), None


def reject_payment(
    kind: str,
    entity: Any,
    user: User,
    remark: str,
    *,
    confirm: bool,
) -> tuple[dict | None, str | None]:
    spec = get_spec(kind)
    if not user_can_reviewer(user, kind, entity):
        return None, "Not allowed to reject this payment."
    if entity.status != spec.pending_review_status:
        return None, "Payment is not awaiting review."
    if not confirm:
        return None, "Confirm rejection with remark."
    remark = (remark or "").strip()
    if not remark:
        return None, "Enter a rejection remark."

    with transaction.atomic():
        locked = spec.model.objects.select_for_update().get(pk=entity.pk)
        if locked.status != spec.pending_review_status:
            return None, "Payment is not awaiting review."
        new_count = int(getattr(locked, "upi_rejection_count", 0) or 0) + 1
        locked.upi_rejection_count = new_count
        locked.upi_last_rejection_remark = remark
        if new_count >= 2:
            locked.status = spec.on_hold_status
        else:
            locked.status = spec.proof_rejected_status
        if kind == "settlement":
            locked.rejection_reason = remark[:512]
        update_fields = [
            "status",
            "upi_rejection_count",
            "upi_last_rejection_remark",
        ]
        if kind == "settlement":
            update_fields.append("rejection_reason")
        else:
            update_fields.append("updated_at")
        locked.save(update_fields=update_fields)
        ct = content_type_for(kind)
        latest = (
            UpiPaymentProofSubmission.objects.filter(content_type=ct, object_id=locked.pk)
            .order_by("-submitted_at")
            .first()
        )
        if latest:
            latest.rejection_remark = remark
            latest.save(update_fields=["rejection_remark"])

    locked.refresh_from_db()
    return serialize_upi_state(kind, locked), None


def report_fraud(
    kind: str, entity: Any, user: User, note: str
) -> tuple[dict | None, str | None]:
    spec = get_spec(kind)
    if not user_can_reviewer(user, kind, entity):
        return None, "Not allowed to report fraud for this payment."
    note = (note or "").strip()
    if not note:
        return None, "Enter a fraud report note."

    with transaction.atomic():
        locked = spec.model.objects.select_for_update().get(pk=entity.pk)
        if getattr(locked, "upi_fraud_reported", False):
            return None, "Fraud already reported for this payment."
        locked.upi_fraud_reported = True
        locked.save(update_fields=["upi_fraud_reported", "updated_at"])
        UpiFraudReport.objects.create(
            content_type=content_type_for(kind),
            object_id=locked.pk,
            reported_by=user,
            note=note,
        )

    locked.refresh_from_db()
    return serialize_upi_state(kind, locked), None


def serialize_fraud_report(row: UpiFraudReport) -> dict:
    ct = row.content_type
    model = ct.model_class()
    label = f"{ct.model}:{row.object_id}"
    amount = ""
    reference = ""
    if model is not None:
        try:
            entity = model.objects.get(pk=row.object_id)
            reference = getattr(entity, "order_reference", None) or getattr(
                entity, "reference", None
            ) or str(row.object_id)
            amount = str(
                getattr(entity, "total_inr", None)
                or getattr(entity, "amount_inr", None)
                or getattr(entity, "cash_estimate_inr", None)
                or ""
            )
        except model.DoesNotExist:
            pass
    reporter = row.reported_by
    return {
        "id": row.pk,
        "kind": ct.model,
        "object_id": row.object_id,
        "reference": reference,
        "amount_inr": amount,
        "note": row.note,
        "status": row.status,
        "reported_by_email": reporter.email if reporter else "",
        "reported_by_name": (
            f"{reporter.first_name} {reporter.last_name}".strip() if reporter else ""
        ),
        "created_at": row.created_at.isoformat(),
        "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
    }
