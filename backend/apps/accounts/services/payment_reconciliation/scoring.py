"""Confidence scoring for payment signals against an order."""

from __future__ import annotations

import re
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from apps.accounts.models import FractionalGoldPurchase, PaymentSignal

TIME_WINDOW_MINUTES = 10
AMOUNT_TOLERANCE_INR = Decimal("1")


def order_refs_for(purchase: FractionalGoldPurchase) -> tuple[str, ...]:
    return (f"CR-{purchase.pk}", f"FR-{purchase.pk}")


def amounts_match(signal_amount: Decimal | None, order_amount: Decimal) -> bool:
    if signal_amount is None:
        return False
    return abs(signal_amount - order_amount) <= AMOUNT_TOLERANCE_INR


def vpas_match(signal_vpa: str, order_vpa: str) -> bool:
    a = (signal_vpa or "").strip().lower()
    b = (order_vpa or "").strip().lower()
    return bool(a and b and a == b)


def order_ref_in_signal(purchase: FractionalGoldPurchase, signal: PaymentSignal) -> bool:
    refs = order_refs_for(purchase)
    haystacks = [
        signal.sms_reference or "",
        (signal.parsed_payload or {}).get("payment_note", ""),
        signal.utr or "",
    ]
    combined = " ".join(haystacks).upper()
    for ref in refs:
        if ref.upper() in combined:
            return True
    return False


def within_time_window(
    signal_at,
    order_created_at,
    *,
    minutes: int = TIME_WINDOW_MINUTES,
) -> bool:
    if signal_at is None or order_created_at is None:
        return False
    delta = abs(signal_at - order_created_at)
    return delta <= timedelta(minutes=minutes)


def calculate_confidence(
    purchase: FractionalGoldPurchase,
    signal: PaymentSignal,
) -> int:
    score = 0
    if amounts_match(signal.amount_inr, purchase.total_inr):
        score += 30
    if vpas_match(signal.upi_vpa, purchase.payee_upi_vpa or ""):
        score += 20
    if order_ref_in_signal(purchase, signal):
        score += 25
    if (signal.utr or "").strip():
        score += 30
    ts = signal.timestamp or timezone.now()
    if within_time_window(ts, purchase.created_at):
        score += 10
    return score
