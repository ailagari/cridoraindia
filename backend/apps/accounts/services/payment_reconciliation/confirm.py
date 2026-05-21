"""Confirm fractional purchase after reconciliation."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.fractional_completion import apply_fractional_purchase_credit_and_liabilities
from apps.accounts.models import FractionalGoldPurchase, PaymentSignal
from apps.accounts.platform_commercial_service import record_spread_fee_on_fractional_confirm

User = get_user_model()


def confirm_fractional_purchase(
    purchase: FractionalGoldPurchase,
    *,
    by_user: User | None = None,
    best_signal: PaymentSignal | None = None,
    decision: str = "auto",
) -> None:
    if purchase.status == FractionalGoldPurchase.COMPLETED:
        return
    apply_fractional_purchase_credit_and_liabilities(purchase)
    record_spread_fee_on_fractional_confirm(purchase)
    purchase.reconciled_at = timezone.now()
    if by_user is not None:
        purchase.confirmed_by = by_user
    if best_signal is not None:
        purchase.best_payment_signal = best_signal
    purchase.save(
        update_fields=[
            "reconciled_at",
            "confirmed_by",
            "best_payment_signal",
            "updated_at",
        ]
    )
