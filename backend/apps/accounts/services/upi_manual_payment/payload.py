"""Build UPI payment payloads for all kinds."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from apps.accounts.models import (
    CridoraPayBill,
    FractionalGoldPurchase,
    GoldLoanRepaymentRequest,
    GoldSellbackRequest,
    PlatformSettlementPayment,
    UpiPaymentProofSubmission,
)
from apps.accounts.services.fractional_upi import payment_payload_for
from apps.accounts.services.sellback_upi import payout_payload_for
from apps.accounts.services.upi_manual_payment.registry import (
    KIND_CRIDORAPAY,
    KIND_FRACTIONAL,
    KIND_LOAN_REPAYMENT,
    KIND_SELLBACK,
    KIND_SETTLEMENT,
    content_type_for,
    get_spec,
)

User = get_user_model()


def _proof_file_url(entity: Any) -> str:
    f = getattr(entity, "upi_proof_file", None) or getattr(entity, "receipt_file", None)
    if f and f.name:
        try:
            return f.url
        except ValueError:
            return ""
    return ""


def serialize_upi_state(kind: str, entity: Any) -> dict:
    spec = get_spec(kind)
    status = getattr(entity, "status", "")
    return {
        "kind": kind,
        "id": entity.pk,
        "status": status,
        "upi_utr": getattr(entity, "upi_utr", "") or getattr(entity, "utr", "") or "",
        "proof_file_url": _proof_file_url(entity),
        "rejection_count": int(getattr(entity, "upi_rejection_count", 0) or 0),
        "last_rejection_remark": getattr(entity, "upi_last_rejection_remark", "")
        or getattr(entity, "rejection_reason", "")
        or "",
        "fraud_reported": bool(getattr(entity, "upi_fraud_reported", False)),
        "can_submit_proof": status in spec.payer_submit_statuses,
        "can_review": status in (spec.pending_review_status, spec.on_hold_status),
        "is_on_hold": status == spec.on_hold_status,
        "is_completed": status == spec.completed_status,
    }


def build_payment_payload(kind: str, entity: Any) -> dict:
    state = serialize_upi_state(kind, entity)
    payment: dict[str, Any] = {}

    if kind == KIND_FRACTIONAL:
        payment = payment_payload_for(entity)
        state["reference"] = payment.get("order_reference") or payment.get("reference")
        state["amount_inr"] = payment.get("amount_inr")
        state["payee_vpa"] = payment.get("payee_vpa")
        state["payee_name"] = payment.get("payee_name")
        state["upi_uri"] = payment.get("upi_uri")
        state["payment_note"] = payment.get("payment_note")
        state["expires_at"] = payment.get("payment_expires_at")
        state["expired"] = payment.get("expired", False)
    elif kind == KIND_LOAN_REPAYMENT:
        from apps.accounts.services.fractional_upi import (
            build_loan_repayment_upi_uri,
            jeweller_upi_payee_name,
        )

        vpa = (entity.payee_upi_vpa or "").strip()
        payee = jeweller_upi_payee_name(entity.loan.jeweller)
        state["reference"] = entity.order_reference
        state["amount_inr"] = str(entity.amount_inr)
        state["payee_vpa"] = vpa
        state["payee_name"] = payee
        state["upi_uri"] = build_loan_repayment_upi_uri(
            vpa=vpa,
            payee_name=payee,
            amount_inr=entity.amount_inr,
            repayment_id=entity.pk,
        )
        state["payment_note"] = entity.payment_note or f"Cridora {entity.order_reference}"
        state["expires_at"] = (
            entity.payment_expires_at.isoformat() if entity.payment_expires_at else None
        )
        state["expired"] = False
        if entity.payment_expires_at:
            from django.utils import timezone

            state["expired"] = timezone.now() > entity.payment_expires_at
    elif kind == KIND_CRIDORAPAY:
        from apps.accounts.services.fractional_upi import build_upi_pay_uri, jeweller_upi_payee_name

        vpa = (entity.payee_upi_vpa or "").strip()
        payee = jeweller_upi_payee_name(entity.jeweller)
        amount = entity.cash_payable_inr if entity.cash_payable_inr else entity.total_inr
        ref = entity.reference
        state["reference"] = ref
        state["amount_inr"] = str(amount)
        state["payee_vpa"] = vpa
        state["payee_name"] = payee
        state["upi_uri"] = build_upi_pay_uri(
            vpa=vpa,
            payee_name=payee,
            amount_inr=amount,
            purchase_id=entity.pk,
            transaction_ref=ref,
            payment_note=entity.payment_note or f"Cridora {ref}",
        )
        state["payment_note"] = entity.payment_note or f"Cridora {ref}"
        state["expires_at"] = entity.expires_at.isoformat() if entity.expires_at else None
        state["expired"] = False
    elif kind == KIND_SELLBACK:
        payment = payout_payload_for(entity)
        state["reference"] = payment.get("reference")
        state["amount_inr"] = payment.get("amount_inr")
        state["payee_vpa"] = payment.get("payee_vpa")
        state["payee_name"] = payment.get("payee_name")
        state["upi_uri"] = payment.get("upi_uri")
        state["payment_note"] = payment.get("payment_note")
        state["expires_at"] = payment.get("payout_expires_at")
        state["expired"] = payment.get("expired", False)
    elif kind == KIND_SETTLEMENT:
        state["reference"] = f"SET-{entity.pk}"
        state["amount_inr"] = str(entity.amount_inr)
        state["payee_vpa"] = ""
        state["payee_name"] = "Cridora Platform"
        state["upi_uri"] = ""
        state["payment_note"] = entity.reference_note or state["reference"]
        state["expires_at"] = None
        state["expired"] = False

    state["payment"] = payment if kind == KIND_FRACTIONAL else {}
    return state


def latest_submissions(kind: str, entity: Any, limit: int = 5) -> list[dict]:
    ct = content_type_for(kind)
    rows = UpiPaymentProofSubmission.objects.filter(
        content_type=ct, object_id=entity.pk
    ).order_by("-submitted_at")[:limit]
    out = []
    for row in rows:
        proof_url = ""
        if row.proof_file and row.proof_file.name:
            try:
                proof_url = row.proof_file.url
            except ValueError:
                proof_url = ""
        out.append(
            {
                "id": row.pk,
                "proof_kind": row.proof_kind,
                "utr": row.utr or "",
                "proof_file_url": proof_url,
                "submitted_at": row.submitted_at.isoformat(),
                "rejection_remark": row.rejection_remark or "",
            }
        )
    return out
