"""Reconciliation engine for loan repayment UPI."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import GoldLoanRepaymentRequest, GoldLoanRequest, PaymentSignal
from apps.accounts.services.payment_reconciliation.engine import (
    RESOLUTION_CONFIRMED,
    RESOLUTION_NEEDS_MANUAL,
    RESOLUTION_PENDING_REVIEW,
    ReconciliationResult,
    THRESHOLD_AUTO,
    THRESHOLD_REVIEW,
)
from apps.accounts.services.payment_reconciliation.fraud import (
    AMOUNT_TOLERANCE_INR,
    FLAG_COLLISION,
    FLAG_DUPLICATE,
    FLAG_SUSPICIOUS,
    blocks_auto_confirm,
)
from apps.accounts.services.fractional_upi import utr_already_used

User = get_user_model()


class _LoanRepaymentScoringAdapter:
    """Adapter so loan repayment requests use fractional scoring."""

    def __init__(self, req: GoldLoanRepaymentRequest):
        self._req = req

    @property
    def total_inr(self):
        return self._req.amount_inr

    @property
    def payee_upi_vpa(self):
        return self._req.payee_upi_vpa or ""

    @property
    def created_at(self):
        return self._req.created_at

    @property
    def pk(self):
        return self._req.pk

    @property
    def payment_note(self):
        return self._req.payment_note or ""


def _loan_refs(req: GoldLoanRepaymentRequest) -> tuple[str, ...]:
    return (req.order_reference, f"LRP-{req.pk}")


def calculate_loan_confidence(
    req: GoldLoanRepaymentRequest,
    signal: PaymentSignal,
) -> int:
    adapter = _LoanRepaymentScoringAdapter(req)
    score = 0
    from apps.accounts.services.payment_reconciliation.scoring import (
        amounts_match,
        order_ref_in_signal,
        vpas_match,
        within_time_window,
    )

    if amounts_match(signal.amount_inr, adapter.total_inr):
        score += 30
    if vpas_match(signal.upi_vpa, adapter.payee_upi_vpa):
        score += 20
    refs = _loan_refs(req)
    hay = " ".join(
        [
            signal.sms_reference or "",
            str((signal.parsed_payload or {}).get("payment_note", "")),
            signal.utr or "",
        ]
    ).upper()
    if any(r.upper() in hay for r in refs):
        score += 25
    if (signal.utr or "").strip():
        score += 30
    if within_time_window(signal.timestamp, adapter.created_at):
        score += 10
    return score


def resolve_loan_repayment(
    req: GoldLoanRepaymentRequest,
    signals: list[PaymentSignal],
) -> ReconciliationResult:
    best_score = 0
    best_signal: PaymentSignal | None = None
    for signal in signals:
        s = calculate_loan_confidence(req, signal)
        if s > best_score:
            best_score, best_signal = s, signal
    flags = _check_loan_fraud_flags(
        req,
        utr=req.upi_utr or (best_signal.utr if best_signal else ""),
        proposed_score=best_score,
    )
    if blocks_auto_confirm(flags):
        return ReconciliationResult(RESOLUTION_NEEDS_MANUAL, best_score, best_signal, flags)
    if flags.get("suspicious") and best_score >= THRESHOLD_AUTO:
        return ReconciliationResult(RESOLUTION_PENDING_REVIEW, best_score, best_signal, flags)
    if best_score >= THRESHOLD_AUTO:
        return ReconciliationResult(RESOLUTION_CONFIRMED, best_score, best_signal, flags)
    if best_score >= THRESHOLD_REVIEW:
        return ReconciliationResult(RESOLUTION_PENDING_REVIEW, best_score, best_signal, flags)
    return ReconciliationResult(RESOLUTION_NEEDS_MANUAL, best_score, best_signal, flags)


def _check_loan_fraud_flags(
    req: GoldLoanRepaymentRequest,
    *,
    utr: str,
    proposed_score: int,
) -> dict[str, bool]:
    flags: dict[str, bool] = {}
    utr_norm = (utr or "").strip().upper()
    if utr_norm and utr_already_used(utr_norm, exclude_repayment_id=req.pk):
        flags[FLAG_DUPLICATE] = True
    if proposed_score >= THRESHOLD_AUTO:
        has_amount = False
        for sig in req.payment_signals.all():
            if sig.amount_inr is not None and abs(sig.amount_inr - req.amount_inr) <= AMOUNT_TOLERANCE_INR:
                has_amount = True
                break
        if not has_amount:
            flags[FLAG_SUSPICIOUS] = True
    since = timezone.now() - timedelta(minutes=10)
    others = GoldLoanRepaymentRequest.objects.filter(
        loan__jeweller_id=req.loan.jeweller_id,
        status=GoldLoanRepaymentRequest.STATUS_PENDING_PAYMENT,
        created_at__gte=since,
    ).exclude(pk=req.pk)
    for other in others:
        if abs(other.amount_inr - req.amount_inr) <= AMOUNT_TOLERANCE_INR:
            flags[FLAG_COLLISION] = True
            break
    return flags


def _apply_loan_repayment_confirmed(req: GoldLoanRepaymentRequest, by_user: User | None) -> None:
    from apps.accounts.loan_service import _apply_loan_repayment

    loan = GoldLoanRequest.objects.select_for_update().get(pk=req.loan_id)
    if loan.status != GoldLoanRequest.STATUS_DISBURSED:
        raise ValueError("Loan is no longer active.")
    _apply_loan_repayment(loan, req.amount_inr)
    req.status = GoldLoanRepaymentRequest.STATUS_COMPLETED
    req.reconciled_at = timezone.now()
    if by_user is not None:
        req.confirmed_by = by_user
    req.save(
        update_fields=[
            "status",
            "reconciled_at",
            "confirmed_by",
            "best_payment_signal",
            "reconciliation_score",
            "reconciliation_flags",
            "updated_at",
        ]
    )


def run_loan_repayment_reconciliation(req: GoldLoanRepaymentRequest) -> ReconciliationResult:
    if req.payment_method != GoldLoanRepaymentRequest.PAY_UPI:
        raise ValueError("Reconciliation applies to UPI repayments only.")
    if req.status == GoldLoanRepaymentRequest.STATUS_COMPLETED:
        return ReconciliationResult(
            RESOLUTION_CONFIRMED,
            req.reconciliation_score or 0,
            req.best_payment_signal,
            req.reconciliation_flags or {},
        )
    signals = list(
        PaymentSignal.objects.filter(loan_repayment_id=req.pk).order_by("-created_at")
    )
    if not signals:
        return ReconciliationResult(RESOLUTION_NEEDS_MANUAL, 0, None, {})
    if req.payment_signal_at is None:
        req.payment_signal_at = timezone.now()
    result = resolve_loan_repayment(req, signals)
    req.reconciliation_score = result.best_score
    req.reconciliation_flags = result.flags
    req.best_payment_signal = result.best_signal
    if req.status == GoldLoanRepaymentRequest.STATUS_PENDING_PAYMENT:
        req.status = GoldLoanRepaymentRequest.STATUS_SIGNAL_RECEIVED
    if result.resolution == RESOLUTION_CONFIRMED:
        with transaction.atomic():
            req = GoldLoanRepaymentRequest.objects.select_for_update().get(pk=req.pk)
            _apply_loan_repayment_confirmed(req, None)
        return result
    status_map = {
        RESOLUTION_PENDING_REVIEW: GoldLoanRepaymentRequest.STATUS_PENDING_REVIEW,
        RESOLUTION_NEEDS_MANUAL: GoldLoanRepaymentRequest.STATUS_NEEDS_MANUAL_VERIFICATION,
    }
    req.status = status_map.get(result.resolution, GoldLoanRepaymentRequest.STATUS_NEEDS_MANUAL_VERIFICATION)
    req.save(
        update_fields=[
            "status",
            "reconciliation_score",
            "reconciliation_flags",
            "best_payment_signal",
            "payment_signal_at",
            "upi_utr",
            "utr_submitted_at",
            "updated_at",
        ]
    )
    return result
