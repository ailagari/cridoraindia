"""Complete scheme contribution and credit ledger + vault."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import VaultHolding
from apps.accounts.vault_service import credit_customer_vault_lines
from apps.schemes.models import (
    CustomerSchemeEnrollment,
    SchemeContribution,
    SchemeLedgerEntry,
)
from apps.schemes.services.month_bucket_service import (
    add_to_month_bucket,
    ensure_month_bucket,
    maybe_create_pending_bonus,
    plan_month_for_date,
)
from apps.schemes.services.unified_scheme_engine import UnifiedSchemeEngine


@transaction.atomic
def apply_contribution_completion(contribution: SchemeContribution) -> None:
    if contribution.status == SchemeContribution.COMPLETED:
        return

    enrollment = contribution.enrollment
    rules = enrollment.rules_snapshot or {}
    engine = UnifiedSchemeEngine(rules)
    kind = engine.ledger_kind_for_deposit()

    enrollment.current_plan_month = plan_month_for_date(enrollment)
    enrollment.save(update_fields=["current_plan_month"])

    bucket = contribution.month_bucket or ensure_month_bucket(enrollment)
    add_to_month_bucket(
        bucket,
        amount_inr=contribution.amount_inr,
        gold_grams=contribution.gold_grams,
    )

    if kind == SchemeLedgerEntry.KIND_CONTRIBUTION_GOLD:
        SchemeLedgerEntry.objects.create(
            enrollment=enrollment,
            cycle_number=enrollment.current_cycle_number,
            entry_kind=kind,
            amount_inr=contribution.amount_inr,
            gold_grams=contribution.gold_grams,
            contribution=contribution,
            month_bucket=bucket,
            note=f"Deposit {contribution.calendar_month}",
        )
        jeweller = enrollment.offering.jeweller
        customer = enrollment.customer
        credit_customer_vault_lines(
            customer,
            jeweller,
            [(VaultHolding.GOLDEN_SCHEME, contribution.gold_grams)],
        )
    else:
        SchemeLedgerEntry.objects.create(
            enrollment=enrollment,
            cycle_number=enrollment.current_cycle_number,
            entry_kind=kind,
            amount_inr=contribution.amount_inr,
            gold_grams=Decimal("0"),
            contribution=contribution,
            month_bucket=bucket,
            note=f"Deposit {contribution.calendar_month}",
        )

    contribution.status = SchemeContribution.COMPLETED
    contribution.completed_at = timezone.now()
    contribution.save(update_fields=["status", "completed_at", "updated_at"])

    maybe_create_pending_bonus(enrollment)


@transaction.atomic
def apply_bonus_confirmation(bonus, *, confirmed_by) -> None:
    from apps.schemes.models import SchemeCycleBonus

    if bonus.status == SchemeCycleBonus.STATUS_CONFIRMED:
        return

    enrollment: CustomerSchemeEnrollment = bonus.enrollment
    rules = enrollment.rules_snapshot or {}
    engine = UnifiedSchemeEngine(rules)
    kind = engine.bonus_ledger_kind(bonus.credit_as)

    if kind == SchemeLedgerEntry.KIND_JEWELLER_BONUS_GOLD:
        rate = Decimal(str(bonus.calculation_snapshot.get("metal_rate") or 0))
        grams = bonus.gold_grams
        if grams <= 0 and rate > 0:
            grams = (bonus.amount_inr / rate).quantize(Decimal("0.000001"))
            bonus.gold_grams = grams
        SchemeLedgerEntry.objects.create(
            enrollment=enrollment,
            cycle_number=bonus.cycle_number,
            entry_kind=kind,
            amount_inr=bonus.amount_inr,
            gold_grams=grams,
            note="Jeweller bonus month",
        )
        credit_customer_vault_lines(
            enrollment.customer,
            enrollment.offering.jeweller,
            [(VaultHolding.GOLDEN_SCHEME, grams)],
        )
    elif kind == SchemeLedgerEntry.KIND_MC_CREDIT:
        SchemeLedgerEntry.objects.create(
            enrollment=enrollment,
            cycle_number=bonus.cycle_number,
            entry_kind=kind,
            amount_inr=bonus.amount_inr,
            note="Jeweller MC credit bonus",
        )
    else:
        SchemeLedgerEntry.objects.create(
            enrollment=enrollment,
            cycle_number=bonus.cycle_number,
            entry_kind=kind,
            amount_inr=bonus.amount_inr,
            note="Jeweller bonus month",
        )

    bonus.status = SchemeCycleBonus.STATUS_CONFIRMED
    bonus.confirmed_by = confirmed_by
    bonus.confirmed_at = timezone.now()
    bonus.save(update_fields=["status", "confirmed_by", "confirmed_at", "gold_grams"])
