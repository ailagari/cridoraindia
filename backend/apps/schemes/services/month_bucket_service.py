"""Month bucket assignment and plan month progression."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db.models import F
from django.utils import timezone

from apps.schemes.models import CustomerSchemeEnrollment, SchemeMonthBucket
from apps.schemes.services.unified_scheme_engine import UnifiedSchemeEngine


def _calendar_month(d: date) -> str:
    return d.strftime("%Y-%m")


def _months_between(anchor: date, current: date) -> int:
    return (current.year - anchor.year) * 12 + (current.month - anchor.month)


def plan_month_for_date(enrollment: CustomerSchemeEnrollment, on_date: date | None = None) -> int:
    """1-based plan month index from cycle anchor."""
    anchor = enrollment.cycle_anchor_date
    today = on_date or timezone.localdate()
    months_elapsed = _months_between(anchor.replace(day=1), today.replace(day=1))
    return max(1, months_elapsed + 1)


def ensure_month_bucket(
    enrollment: CustomerSchemeEnrollment,
    *,
    on_date: date | None = None,
) -> SchemeMonthBucket:
    on_date = on_date or timezone.localdate()
    plan_month = plan_month_for_date(enrollment, on_date)
    cal = _calendar_month(on_date)
    rules = enrollment.rules_snapshot or {}
    cycle = rules.get("cycle") or {}
    customer_months = cycle.get("customer_months") or 11
    bonus_month = cycle.get("jeweller_bonus_month") or (customer_months + 1)

    bucket, _ = SchemeMonthBucket.objects.get_or_create(
        enrollment=enrollment,
        cycle_number=enrollment.current_cycle_number,
        calendar_month=cal,
        defaults={
            "month_index": plan_month,
            "is_customer_month": plan_month <= customer_months,
            "is_bonus_month": plan_month == bonus_month,
        },
    )
    if bucket.month_index != plan_month:
        bucket.month_index = plan_month
        bucket.is_customer_month = plan_month <= customer_months
        bucket.is_bonus_month = plan_month == bonus_month
        bucket.save(update_fields=["month_index", "is_customer_month", "is_bonus_month", "updated_at"])
    return bucket


def add_to_month_bucket(
    bucket: SchemeMonthBucket,
    *,
    amount_inr: Decimal,
    gold_grams: Decimal,
) -> None:
    SchemeMonthBucket.objects.filter(pk=bucket.pk).update(
        monthly_total_inr=F("monthly_total_inr") + amount_inr,
        monthly_total_grams=F("monthly_total_grams") + gold_grams,
        deposit_count=F("deposit_count") + 1,
    )
    bucket.refresh_from_db()


def enrollment_balances(enrollment: CustomerSchemeEnrollment) -> dict:
    from apps.schemes.models import SchemeLedgerEntry

    inr = Decimal("0")
    gold = Decimal("0")
    mc_credit = Decimal("0")
    for e in SchemeLedgerEntry.objects.filter(enrollment=enrollment):
        k = e.entry_kind
        if k in (
            SchemeLedgerEntry.KIND_CONTRIBUTION_INR,
            SchemeLedgerEntry.KIND_JEWELLER_BONUS_INR,
        ):
            inr += e.amount_inr
        elif k == SchemeLedgerEntry.KIND_MC_CREDIT:
            mc_credit += e.amount_inr
        elif k == SchemeLedgerEntry.KIND_MC_APPLIED:
            mc_credit -= e.amount_inr
        elif k == SchemeLedgerEntry.KIND_REDEMPTION_DEBIT_INR:
            inr -= e.amount_inr
        elif k in (
            SchemeLedgerEntry.KIND_CONTRIBUTION_GOLD,
            SchemeLedgerEntry.KIND_JEWELLER_BONUS_GOLD,
        ):
            gold += e.gold_grams
        elif k == SchemeLedgerEntry.KIND_REDEMPTION_DEBIT_GOLD:
            gold -= e.gold_grams
    return {
        "inr_balance": inr.quantize(Decimal("0.01")),
        "gold_grams_balance": gold.quantize(Decimal("0.000001")),
        "making_charge_credit_inr": max(Decimal("0"), mc_credit.quantize(Decimal("0.01"))),
    }


def maybe_create_pending_bonus(enrollment: CustomerSchemeEnrollment) -> None:
    from apps.schemes.models import SchemeCycleBonus

    rules = enrollment.rules_snapshot or {}
    engine = UnifiedSchemeEngine(rules)
    cycle = rules.get("cycle") or {}
    if not cycle.get("enabled") or not rules.get("bonus", {}).get("enabled"):
        return

    bonus_month = cycle.get("jeweller_bonus_month")
    if enrollment.current_plan_month < bonus_month:
        return

    if SchemeCycleBonus.objects.filter(
        enrollment=enrollment, cycle_number=enrollment.current_cycle_number
    ).exists():
        return

    buckets = list(
        SchemeMonthBucket.objects.filter(
            enrollment=enrollment,
            cycle_number=enrollment.current_cycle_number,
            is_customer_month=True,
        ).order_by("month_index")
        .values("month_index", "monthly_total_inr", "is_customer_month")
    )
    offering = enrollment.offering
    credit_override = (offering.jeweller_overrides or {}).get("bonus_credit_as")
    result = engine.compute_bonus_from_buckets(buckets, credit_as_override=credit_override)

    SchemeCycleBonus.objects.create(
        enrollment=enrollment,
        cycle_number=enrollment.current_cycle_number,
        bonus_month_index=bonus_month,
        amount_inr=result["amount_inr"],
        credit_as=result["credit_as"],
        calculation_snapshot=result,
    )
    enrollment.status = CustomerSchemeEnrollment.STATUS_PLAN_MONTH_COMPLETE
    enrollment.save(update_fields=["status"])
