"""Submit UTR or screenshot proof."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import (
    CridoraPayBill,
    FractionalGoldPurchase,
    GoldLoanRepaymentRequest,
    GoldSellbackRequest,
    PlatformSettlementPayment,
    UpiPaymentProofSubmission,
)
from apps.accounts.services.fractional_upi import normalize_utr, utr_validation_error
from apps.accounts.services.upi_manual_payment.payload import serialize_upi_state
from apps.accounts.services.upi_manual_payment.registry import (
    KIND_SETTLEMENT,
    content_type_for,
    get_spec,
    user_can_payer,
)

User = get_user_model()


def _utr_globally_used(utr: str, *, exclude_kind: str | None, exclude_id: int | None) -> bool:
    if FractionalGoldPurchase.objects.filter(upi_utr=utr).exclude(
        status=FractionalGoldPurchase.CANCELLED
    ).exclude(pk=exclude_id if exclude_kind == "fractional" else None).exists():
        return True
    if GoldLoanRepaymentRequest.objects.filter(upi_utr=utr).exclude(
        status=GoldLoanRepaymentRequest.STATUS_CANCELLED
    ).exclude(pk=exclude_id if exclude_kind == "loan_repayment" else None).exists():
        return True
    if GoldSellbackRequest.objects.filter(upi_utr=utr).exclude(
        status=GoldSellbackRequest.STATUS_CANCELLED
    ).exclude(pk=exclude_id if exclude_kind == "sellback" else None).exists():
        return True
    if CridoraPayBill.objects.filter(upi_utr=utr).exclude(
        status__in=(CridoraPayBill.STATUS_CANCELLED, CridoraPayBill.STATUS_EXPIRED)
    ).exclude(pk=exclude_id if exclude_kind == "cridorapay" else None).exists():
        return True
    if PlatformSettlementPayment.objects.filter(utr=utr).exclude(
        status=PlatformSettlementPayment.STATUS_REJECTED
    ).exclude(pk=exclude_id if exclude_kind == "settlement" else None).exists():
        return True
    ct_ids = UpiPaymentProofSubmission.objects.filter(utr=utr).values_list(
        "content_type_id", "object_id"
    )
    for ct_id, obj_id in ct_ids:
        if exclude_kind and exclude_id and obj_id == exclude_id:
            ct = content_type_for(exclude_kind)
            if ct.pk == ct_id:
                continue
        return True
    return False


def _apply_proof_to_entity(kind: str, entity: Any, *, utr: str, proof_file) -> None:
    if kind == KIND_SETTLEMENT:
        if utr:
            entity.utr = utr
        if proof_file:
            entity.receipt_file = proof_file
        entity.status = PlatformSettlementPayment.STATUS_SUBMITTED
        entity.save(update_fields=["utr", "receipt_file", "status"])
        return
    if utr:
        entity.upi_utr = utr
        entity.utr_submitted_at = timezone.now()
    if proof_file:
        entity.upi_proof_file = proof_file
    spec = get_spec(kind)
    entity.status = spec.pending_review_status
    update_fields = ["status", "updated_at"]
    if utr:
        update_fields.extend(["upi_utr", "utr_submitted_at"])
    if proof_file:
        update_fields.append("upi_proof_file")
    entity.save(update_fields=update_fields)


def submit_utr(
    kind: str, entity: Any, user: User, raw_utr: str
) -> tuple[dict | None, str | None]:
    spec = get_spec(kind)
    if not user_can_payer(user, kind, entity):
        return None, "Not allowed to submit proof for this payment."
    if entity.status == spec.on_hold_status:
        return None, "This payment is on hold. Visit in person to resolve."
    if entity.status not in spec.payer_submit_statuses:
        return None, "Payment is not awaiting proof submission."
    utr_err = utr_validation_error(raw_utr)
    if utr_err:
        return None, utr_err
    utr = normalize_utr(raw_utr)
    if not utr:
        return None, "Enter a valid UTR number."
    if _utr_globally_used(utr, exclude_kind=kind, exclude_id=entity.pk):
        return None, "This UTR is already linked to another payment."

    with transaction.atomic():
        locked = spec.model.objects.select_for_update().get(pk=entity.pk)
        if locked.status not in spec.payer_submit_statuses:
            return None, "Payment is not awaiting proof submission."
        UpiPaymentProofSubmission.objects.create(
            content_type=content_type_for(kind),
            object_id=locked.pk,
            proof_kind=UpiPaymentProofSubmission.PROOF_UTR,
            utr=utr,
            submitted_by=user,
        )
        _apply_proof_to_entity(kind, locked, utr=utr, proof_file=None)

    locked.refresh_from_db()
    return serialize_upi_state(kind, locked), None


def submit_screenshot(
    kind: str, entity: Any, user: User, proof_file, raw_utr: str = ""
) -> tuple[dict | None, str | None]:
    spec = get_spec(kind)
    if not user_can_payer(user, kind, entity):
        return None, "Not allowed to submit proof for this payment."
    if entity.status == spec.on_hold_status:
        return None, "This payment is on hold. Visit in person to resolve."
    if entity.status not in spec.payer_submit_statuses:
        return None, "Payment is not awaiting proof submission."
    if not proof_file:
        return None, "Upload a payment screenshot."
    utr = ""
    if raw_utr.strip():
        utr_err = utr_validation_error(raw_utr)
        if utr_err:
            return None, utr_err
        utr = normalize_utr(raw_utr) or ""
        if utr and _utr_globally_used(utr, exclude_kind=kind, exclude_id=entity.pk):
            return None, "This UTR is already linked to another payment."

    with transaction.atomic():
        locked = spec.model.objects.select_for_update().get(pk=entity.pk)
        if locked.status not in spec.payer_submit_statuses:
            return None, "Payment is not awaiting proof submission."
        submission = UpiPaymentProofSubmission(
            content_type=content_type_for(kind),
            object_id=locked.pk,
            proof_kind=UpiPaymentProofSubmission.PROOF_SCREENSHOT,
            utr=utr,
            submitted_by=user,
        )
        submission.proof_file = proof_file
        submission.save()
        _apply_proof_to_entity(kind, locked, utr=utr, proof_file=proof_file)

    locked.refresh_from_db()
    return serialize_upi_state(kind, locked), None
