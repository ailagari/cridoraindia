"""Enrollment and offering helpers."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.schemes.models import (
    CustomerSchemeEnrollment,
    JewellerSchemeOffering,
    SchemeTemplate,
)
from apps.schemes.services.scheme_design_compiler import compile_scheme_design
from apps.schemes.services.month_bucket_service import plan_month_for_date

User = get_user_model()


def effective_rules(offering: JewellerSchemeOffering) -> dict:
    return offering.rules_snapshot or offering.scheme_template.scheme_rules or {}


def effective_design(offering: JewellerSchemeOffering) -> dict:
    return offering.design_snapshot or offering.scheme_template.scheme_design or {}


@transaction.atomic
def create_offering(
    jeweller: User,
    template: SchemeTemplate,
    *,
    display_name: str = "",
    customer_facing_note: str = "",
    jeweller_overrides: dict | None = None,
) -> JewellerSchemeOffering:
    if template.status != SchemeTemplate.STATUS_PUBLISHED:
        raise ValueError("Scheme template is not published.")
    overrides = jeweller_overrides or {}
    allowed = set((template.scheme_design or {}).get("jeweller_can_override") or [])
    filtered = {k: v for k, v in overrides.items() if k in allowed or k == "display_name"}

    offering, created = JewellerSchemeOffering.objects.get_or_create(
        jeweller=jeweller,
        scheme_template=template,
        defaults={
            "display_name": display_name or template.name,
            "customer_facing_note": customer_facing_note,
            "jeweller_overrides": filtered,
            "design_snapshot": template.scheme_design,
            "rules_snapshot": template.scheme_rules,
            "status": JewellerSchemeOffering.STATUS_ACTIVE,
        },
    )
    if not created:
        offering.display_name = display_name or offering.display_name
        offering.customer_facing_note = customer_facing_note
        offering.jeweller_overrides = filtered
        offering.design_snapshot = template.scheme_design
        offering.rules_snapshot = template.scheme_rules
        offering.status = JewellerSchemeOffering.STATUS_ACTIVE
        offering.save()
    return offering


@transaction.atomic
def enroll_customer(
    customer: User,
    offering: JewellerSchemeOffering,
) -> CustomerSchemeEnrollment:
    if offering.status != JewellerSchemeOffering.STATUS_ACTIVE:
        raise ValueError("Offering is not active.")
    existing = CustomerSchemeEnrollment.objects.filter(
        customer=customer,
        offering=offering,
        status=CustomerSchemeEnrollment.STATUS_ACTIVE,
    ).first()
    if existing:
        return existing

    today = timezone.localdate()
    enrollment = CustomerSchemeEnrollment.objects.create(
        customer=customer,
        offering=offering,
        design_snapshot=effective_design(offering),
        rules_snapshot=effective_rules(offering),
        cycle_anchor_date=today,
        current_plan_month=plan_month_for_date(
            CustomerSchemeEnrollment(cycle_anchor_date=today),
            today,
        ),
    )
    return enrollment


def serialize_offering_brief(offering: JewellerSchemeOffering) -> dict:
    t = offering.scheme_template
    return {
        "id": offering.id,
        "display_name": offering.display_name or t.name,
        "customer_facing_note": offering.customer_facing_note,
        "flow_summary": t.flow_summary,
        "category": t.category,
        "template_id": t.id,
        "template_slug": t.slug,
        "status": offering.status,
        "scheme_design": offering.design_snapshot,
        "jeweller_overrides_allowed": (offering.design_snapshot or {}).get(
            "jeweller_can_override", []
        ),
    }


def serialize_enrollment(enrollment: CustomerSchemeEnrollment) -> dict:
    from apps.schemes.services.month_bucket_service import enrollment_balances

    offering = enrollment.offering
    balances = enrollment_balances(enrollment)
    buckets = list(
        enrollment.month_buckets.filter(
            cycle_number=enrollment.current_cycle_number
        ).order_by("month_index")
    )
    return {
        "id": enrollment.id,
        "status": enrollment.status,
        "current_cycle_number": enrollment.current_cycle_number,
        "current_plan_month": enrollment.current_plan_month,
        "cycle_anchor_date": enrollment.cycle_anchor_date.isoformat(),
        "started_at": enrollment.started_at.isoformat(),
        "offering": serialize_offering_brief(offering),
        "jeweller": {
            "id": offering.jeweller_id,
            "business_name": offering.jeweller.business_name or offering.jeweller.email,
        },
        "balances": {k: str(v) for k, v in balances.items()},
        "month_buckets": [
            {
                "month_index": b.month_index,
                "calendar_month": b.calendar_month,
                "monthly_total_inr": str(b.monthly_total_inr),
                "monthly_total_grams": str(b.monthly_total_grams),
                "deposit_count": b.deposit_count,
                "is_customer_month": b.is_customer_month,
                "is_bonus_month": b.is_bonus_month,
            }
            for b in buckets
        ],
    }
