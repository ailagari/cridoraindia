"""Redemption quote and confirm."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounts.fractional_service import fractional_metal_rate_inr_per_gram
from apps.accounts.models import VaultHolding
from apps.accounts.vault_service import debit_customer_vault_lines
from apps.schemes.models import SchemeLedgerEntry, SchemeRedemption
from apps.schemes.services.month_bucket_service import enrollment_balances
from apps.schemes.services.unified_scheme_engine import UnifiedSchemeEngine


def quote_redemption(enrollment, *, ornament_metal_inr=Decimal("0"), ornament_making_inr=Decimal("0")) -> dict:
    balances = enrollment_balances(enrollment)
    engine = UnifiedSchemeEngine(enrollment.rules_snapshot or {})
    rate = fractional_metal_rate_inr_per_gram()
    bonus_confirmed = enrollment.cycle_bonuses.filter(status="confirmed").exists()
    if not engine.can_redeem_now(
        plan_month=enrollment.current_plan_month,
        bonus_confirmed=bonus_confirmed,
    ):
        return {"can_redeem": False, "detail": "Redemption not available until plan requirements are met."}
    return engine.quote_redemption(
        inr_balance=balances["inr_balance"],
        gold_grams=balances["gold_grams_balance"],
        mc_credit_inr=balances["making_charge_credit_inr"],
        metal_rate=rate,
        ornament_metal_inr=ornament_metal_inr,
        ornament_making_inr=ornament_making_inr,
        offering_overrides=enrollment.offering.jeweller_overrides,
    )


@transaction.atomic
def confirm_redemption(enrollment, quote: dict) -> SchemeRedemption:
    redemption = SchemeRedemption.objects.create(
        enrollment=enrollment,
        redeem_as=quote.get("mode", "jewellery_inr_pool"),
        amount_inr_from_pool=Decimal(str(quote.get("from_pool_inr", 0))),
        gold_grams_debited=Decimal(str(quote.get("gold_grams_debited", 0))),
        making_charge_inr=Decimal(str(quote.get("making_charge_inr", 0))),
        mc_credit_applied_inr=Decimal(str(quote.get("mc_credit_applied_inr", 0))),
        topup_inr=Decimal(str(quote.get("topup_inr", 0))),
        quote_snapshot=quote,
        status=SchemeRedemption.STATUS_COMPLETED,
        completed_at=timezone.now(),
    )

    if redemption.amount_inr_from_pool > 0:
        SchemeLedgerEntry.objects.create(
            enrollment=enrollment,
            cycle_number=enrollment.current_cycle_number,
            entry_kind=SchemeLedgerEntry.KIND_REDEMPTION_DEBIT_INR,
            amount_inr=redemption.amount_inr_from_pool,
            note=f"Redemption #{redemption.id}",
        )
    if redemption.mc_credit_applied_inr > 0:
        SchemeLedgerEntry.objects.create(
            enrollment=enrollment,
            cycle_number=enrollment.current_cycle_number,
            entry_kind=SchemeLedgerEntry.KIND_MC_APPLIED,
            amount_inr=redemption.mc_credit_applied_inr,
            note=f"MC credit applied redemption #{redemption.id}",
        )
    if redemption.gold_grams_debited > 0:
        SchemeLedgerEntry.objects.create(
            enrollment=enrollment,
            cycle_number=enrollment.current_cycle_number,
            entry_kind=SchemeLedgerEntry.KIND_REDEMPTION_DEBIT_GOLD,
            gold_grams=redemption.gold_grams_debited,
            note=f"Redemption #{redemption.id}",
        )
        debit_customer_vault_lines(
            enrollment.customer,
            enrollment.offering.jeweller,
            [(VaultHolding.GOLDEN_SCHEME, redemption.gold_grams_debited)],
        )

    enrollment.status = enrollment.STATUS_REDEEMED
    enrollment.completed_at = timezone.now()
    enrollment.save(update_fields=["status", "completed_at"])

    return redemption
