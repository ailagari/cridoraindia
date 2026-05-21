"""Pluggable bank / jeweller transaction feed (not implemented in v1)."""

from __future__ import annotations

from apps.accounts.models import PaymentSignal


def ingest_transactions(jeweller_id: int, rows: list[dict]) -> list[PaymentSignal]:
    """
    Future: ingest PSP/bank rows into PaymentSignal with source=bank_feed.
    Set BANK_FEED_ENABLED=true when a provider is wired.
    """
    _ = jeweller_id, rows
    return []
