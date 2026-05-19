"""Shared copy for gold price movement push notifications (Web Push + Android FCM)."""

from __future__ import annotations

from decimal import Decimal


def format_gold_price_move_body(*, baseline: Decimal, current: Decimal) -> str:
    """
    Example: Gold price has decreased by ₹10.00 from 7,505.74 to 7,495.74.
    Uses public Cridora 22K reference (₹/g).
    """
    baseline_q = baseline.quantize(Decimal("0.01"))
    current_q = current.quantize(Decimal("0.01"))
    delta = (current_q - baseline_q).quantize(Decimal("0.01"))
    swing = abs(delta)
    verb = "increased" if delta > 0 else "decreased"
    return (
        f"Gold price has {verb} by ₹{swing:,.2f} "
        f"from {baseline_q:,.2f} to {current_q:,.2f}."
    )
