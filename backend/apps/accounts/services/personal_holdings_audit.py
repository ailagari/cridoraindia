"""Audit trail for personal holdings and vault documents."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from apps.accounts.models import (
    PersonalGoldHolding,
    PersonalHoldingDocument,
    PersonalPortfolioAuditLog,
)

User = get_user_model()


def log_personal_portfolio_action(
    *,
    subject_user: User,
    action: str,
    actor_type: str,
    actor_id: int | None,
    holding: PersonalGoldHolding | None = None,
    document: PersonalHoldingDocument | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    PersonalPortfolioAuditLog.objects.create(
        subject_user=subject_user,
        holding=holding,
        document=document,
        actor_type=actor_type,
        actor_id=actor_id,
        action=action,
        metadata=metadata or {},
    )
