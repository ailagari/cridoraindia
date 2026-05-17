"""Append-only event log."""

from __future__ import annotations

from typing import Any

from apps.accounts.models import CrossRedemptionEvent, CrossRedemptionRequest


def log_event(
    req: CrossRedemptionRequest,
    *,
    actor: str,
    event_type: str,
    payload: dict[str, Any] | None = None,
) -> CrossRedemptionEvent:
    return CrossRedemptionEvent.objects.create(
        request=req,
        actor=actor,
        event_type=event_type,
        payload=payload or {},
    )
