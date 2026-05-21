"""Fraud and duplicate checks before auto-confirm."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from apps.accounts.models import FractionalGoldPurchase
from apps.accounts.services.fractional_upi import utr_already_used

FLAG_DUPLICATE = "duplicate"
FLAG_SUSPICIOUS = "suspicious"
FLAG_COLLISION = "collision"

COLLISION_WINDOW_MINUTES = 10
AMOUNT_TOLERANCE_INR = Decimal("1")


def check_fraud_flags(
    purchase: FractionalGoldPurchase,
    *,
    utr: str,
    proposed_score: int,
) -> dict[str, bool]:
    flags: dict[str, bool] = {}
    utr_norm = (utr or "").strip().upper()
    if utr_norm and utr_already_used(utr_norm, exclude_purchase_id=purchase.pk):
        flags[FLAG_DUPLICATE] = True
    if proposed_score >= 85:
        if purchase.total_inr and not _has_amount_match_signal(purchase):
            flags[FLAG_SUSPICIOUS] = True
    if _has_amount_collision(purchase):
        flags[FLAG_COLLISION] = True
    return flags


def _has_amount_match_signal(purchase: FractionalGoldPurchase) -> bool:
    for sig in purchase.payment_signals.all():
        if sig.amount_inr is None:
            continue
        if abs(sig.amount_inr - purchase.total_inr) <= AMOUNT_TOLERANCE_INR:
            return True
    return False


def _has_amount_collision(purchase: FractionalGoldPurchase) -> bool:
    since = timezone.now() - timedelta(minutes=COLLISION_WINDOW_MINUTES)
    others = FractionalGoldPurchase.objects.filter(
        jeweller_id=purchase.jeweller_id,
        status=FractionalGoldPurchase.PENDING_PAYMENT,
        created_at__gte=since,
    ).exclude(pk=purchase.pk)
    for other in others:
        if abs(other.total_inr - purchase.total_inr) <= AMOUNT_TOLERANCE_INR:
            return True
    return False


def blocks_auto_confirm(flags: dict[str, bool]) -> bool:
    return bool(flags.get(FLAG_DUPLICATE) or flags.get(FLAG_COLLISION))
