"""Reconciliation engine: score signals and resolve order status."""

from __future__ import annotations

from dataclasses import dataclass

from django.utils import timezone

from apps.accounts.models import FractionalGoldPurchase, PaymentSignal
from apps.accounts.services.payment_reconciliation.confirm import confirm_fractional_purchase
from apps.accounts.services.payment_reconciliation.fraud import (
    blocks_auto_confirm,
    check_fraud_flags,
)
from apps.accounts.services.payment_reconciliation.scoring import calculate_confidence
from apps.accounts.services.payment_reconciliation.signals import ensure_payment_signal_at

THRESHOLD_AUTO = 85
THRESHOLD_REVIEW = 60

RESOLUTION_CONFIRMED = "confirmed"
RESOLUTION_PENDING_REVIEW = "pending_review"
RESOLUTION_NEEDS_MANUAL = "needs_manual"


@dataclass(frozen=True)
class ReconciliationResult:
    resolution: str
    best_score: int
    best_signal: PaymentSignal | None
    flags: dict[str, bool]


def resolve_order(
    purchase: FractionalGoldPurchase,
    signals: list[PaymentSignal],
) -> ReconciliationResult:
    best_score = 0
    best_signal: PaymentSignal | None = None
    for signal in signals:
        score = calculate_confidence(purchase, signal)
        if score > best_score:
            best_score = score
            best_signal = signal
    utr = purchase.upi_utr or (best_signal.utr if best_signal else "")
    flags = check_fraud_flags(purchase, utr=utr, proposed_score=best_score)
    if blocks_auto_confirm(flags):
        if best_score >= THRESHOLD_REVIEW:
            return ReconciliationResult(
                RESOLUTION_NEEDS_MANUAL, best_score, best_signal, flags
            )
        return ReconciliationResult(
            RESOLUTION_NEEDS_MANUAL, best_score, best_signal, flags
        )
    if flags.get("suspicious") and best_score >= THRESHOLD_AUTO:
        return ReconciliationResult(
            RESOLUTION_PENDING_REVIEW, best_score, best_signal, flags
        )
    if best_score >= THRESHOLD_AUTO:
        return ReconciliationResult(
            RESOLUTION_CONFIRMED, best_score, best_signal, flags
        )
    if best_score >= THRESHOLD_REVIEW:
        return ReconciliationResult(
            RESOLUTION_PENDING_REVIEW, best_score, best_signal, flags
        )
    return ReconciliationResult(
        RESOLUTION_NEEDS_MANUAL, best_score, best_signal, flags
    )


def _status_for_resolution(resolution: str) -> str:
    if resolution == RESOLUTION_CONFIRMED:
        return FractionalGoldPurchase.COMPLETED
    if resolution == RESOLUTION_PENDING_REVIEW:
        return FractionalGoldPurchase.PENDING_REVIEW
    return FractionalGoldPurchase.NEEDS_MANUAL_VERIFICATION


def run_reconciliation(purchase: FractionalGoldPurchase) -> ReconciliationResult:
    if purchase.payment_method != FractionalGoldPurchase.PAY_UPI:
        raise ValueError("Reconciliation applies to UPI orders only.")
    if purchase.status == FractionalGoldPurchase.COMPLETED:
        return ReconciliationResult(
            RESOLUTION_CONFIRMED,
            purchase.reconciliation_score or 0,
            purchase.best_payment_signal,
            purchase.reconciliation_flags or {},
        )
    if purchase.status in (
        FractionalGoldPurchase.CANCELLED,
        FractionalGoldPurchase.REJECTED,
    ):
        return ReconciliationResult(
            RESOLUTION_NEEDS_MANUAL,
            purchase.reconciliation_score or 0,
            None,
            purchase.reconciliation_flags or {},
        )
    signals = list(
        PaymentSignal.objects.filter(fractional_purchase_id=purchase.pk).order_by(
            "-created_at"
        )
    )
    if not signals:
        return ReconciliationResult(
            RESOLUTION_NEEDS_MANUAL, 0, None, purchase.reconciliation_flags or {}
        )
    ensure_payment_signal_at(purchase)
    result = resolve_order(purchase, signals)
    purchase.reconciliation_score = result.best_score
    purchase.reconciliation_flags = result.flags
    purchase.best_payment_signal = result.best_signal
    if purchase.status == FractionalGoldPurchase.PENDING_PAYMENT:
        purchase.status = FractionalGoldPurchase.SIGNAL_RECEIVED
    if result.resolution == RESOLUTION_CONFIRMED:
        confirm_fractional_purchase(
            purchase,
            best_signal=result.best_signal,
            decision="auto",
        )
        return result
    purchase.status = _status_for_resolution(result.resolution)
    purchase.save(
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
