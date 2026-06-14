"""Create and quote scheme contributions."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounts.services.fractional_upi import (
    default_payment_expires_at,
    jeweller_upi_vpa,
)
from apps.schemes.models import SchemeContribution
from apps.schemes.services.month_bucket_service import (
    _calendar_month,
    ensure_month_bucket,
    plan_month_for_date,
)
from apps.schemes.services.unified_scheme_engine import UnifiedSchemeEngine


def _jeweller_mc_defaults(jeweller) -> tuple[Decimal, Decimal]:
    profile = getattr(jeweller, "jeweller_pricing_profile", None)
    if not profile:
        return Decimal("0"), Decimal("0")
    return (
        Decimal(str(profile.representative_making_charge_inr_per_gram or 0)),
        Decimal("0"),
    )


from apps.schemes.services.enrollment_service import assert_payments_allowed


def quote_contribution(enrollment, total_inr: Decimal) -> dict:
    assert_payments_allowed(enrollment)
    engine = UnifiedSchemeEngine(enrollment.rules_snapshot or {})
    mc_pg, mc_pct = _jeweller_mc_defaults(enrollment.offering.jeweller)
    ov = enrollment.offering.jeweller_overrides or {}
    c = (enrollment.rules_snapshot or {}).get("contribution") or {}
    if c.get("making_charge_mode") == "jeweller_percent":
        scheme_pct = c.get("making_charge_percent")
        if scheme_pct is not None:
            mc_pct = Decimal(str(scheme_pct))
    elif ov.get("redemption_making_charge_percent") is not None:
        mc_pct = Decimal(str(ov["redemption_making_charge_percent"]))
    err = engine.validate_deposit_amount(total_inr, offering_overrides=ov)
    if err:
        raise ValueError(err)
    return engine.quote_deposit(total_inr, jeweller_mc_per_gram=mc_pg, jeweller_mc_percent=mc_pct)


@transaction.atomic
def create_contribution(
    enrollment,
    *,
    total_inr: Decimal,
    payment_method: str,
    customer_note: str = "",
) -> SchemeContribution:
    assert_payments_allowed(enrollment)
    q = quote_contribution(enrollment, total_inr)
    today = timezone.localdate()
    cal = _calendar_month(today)
    bucket = ensure_month_bucket(enrollment, on_date=today)
    seq = bucket.deposit_count + 1

    status = SchemeContribution.PENDING_PAYMENT
    if payment_method == SchemeContribution.PAY_COUNTER:
        status = SchemeContribution.AWAITING_COUNTER

    contribution = SchemeContribution.objects.create(
        enrollment=enrollment,
        month_bucket=bucket,
        cycle_number=enrollment.current_cycle_number,
        calendar_month=cal,
        deposit_sequence_in_month=seq,
        amount_inr=Decimal(str(q["total_inr"])),
        gold_grams=Decimal(str(q["gold_grams"])),
        gold_value_inr_pre_gst=Decimal(str(q["gold_value_inr_pre_gst"])),
        gst_percent=Decimal(str(q["gst_percent"])),
        gst_inr=Decimal(str(q["gst_inr"])),
        making_charge_inr=Decimal(str(q["making_charge_inr"])),
        metal_rate_inr_per_gram=Decimal(str(q["metal_rate_inr_per_gram"])),
        payment_method=payment_method,
        status=status,
        customer_note=customer_note,
    )

    enrollment.current_plan_month = plan_month_for_date(enrollment, today)
    enrollment.save(update_fields=["current_plan_month"])

    if payment_method == SchemeContribution.PAY_UPI:
        jeweller = enrollment.offering.jeweller
        vpa = jeweller_upi_vpa(jeweller)
        contribution.payee_upi_vpa = vpa or ""
        contribution.payment_note = f"Cridora SC-{contribution.pk}"
        contribution.payment_expires_at = default_payment_expires_at()
        contribution.save(
            update_fields=[
                "payee_upi_vpa",
                "payment_note",
                "payment_expires_at",
                "updated_at",
            ]
        )

    return contribution


def serialize_contribution(c: SchemeContribution) -> dict:
    return {
        "id": c.id,
        "reference": c.order_reference,
        "enrollment_id": c.enrollment_id,
        "calendar_month": c.calendar_month,
        "deposit_sequence_in_month": c.deposit_sequence_in_month,
        "amount_inr": str(c.amount_inr),
        "gold_grams": str(c.gold_grams),
        "gold_value_inr_pre_gst": str(c.gold_value_inr_pre_gst),
        "gst_percent": str(c.gst_percent),
        "gst_inr": str(c.gst_inr),
        "making_charge_inr": str(c.making_charge_inr),
        "metal_rate_inr_per_gram": str(c.metal_rate_inr_per_gram),
        "payment_method": c.payment_method,
        "status": c.status,
        "customer_note": c.customer_note,
        "created_at": c.created_at.isoformat(),
        "completed_at": c.completed_at.isoformat() if c.completed_at else None,
        "payee_upi_vpa": c.payee_upi_vpa or "",
        "payment_note": c.payment_note or "",
        "payment_expires_at": (
            c.payment_expires_at.isoformat() if c.payment_expires_at else None
        ),
        "upi_utr": c.upi_utr or "",
    }
