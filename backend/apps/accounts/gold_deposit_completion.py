"""Complete gold deposit intake: credit deposit vault + jeweller custodial liability."""

from __future__ import annotations

from django.utils import timezone

from .jeweller_liability_service import increment_custodial_liability_for_gold_deposit
from .models import GoldDepositIntake
from .vault_service import credit_customer_deposit


def apply_gold_deposit_credit_and_liabilities(intake: GoldDepositIntake) -> None:
    """Caller must hold intake row locked (select_for_update) inside transaction.atomic."""
    credit_customer_deposit(intake.customer, intake.jeweller, intake.grams)
    increment_custodial_liability_for_gold_deposit(
        intake.jeweller,
        intake.customer,
        intake.grams,
        intake,
    )
    intake.status = GoldDepositIntake.COMPLETED
    intake.completed_at = timezone.now()
    intake.save(update_fields=["status", "completed_at", "updated_at"])
    from apps.accounts.services.user_push_notify import notify_gold_deposit_completed

    notify_gold_deposit_completed(intake)
