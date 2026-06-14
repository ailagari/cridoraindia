"""Enrollment and offering helpers."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.accounts.services.jeweller_referral import customer_secondary_jeweller_ids
from apps.accounts.services.personal_holdings import normalize_phone_digits
from apps.schemes.models import (
    CustomerSchemeEnrollment,
    JewellerSchemeOffering,
    SchemeTemplate,
)
from apps.schemes.services.scheme_design_compiler import compile_scheme_design
from apps.schemes.services.month_bucket_service import plan_month_for_date

User = get_user_model()

OPEN_ENROLLMENT_STATUSES = (
    CustomerSchemeEnrollment.STATUS_ACTIVE,
    CustomerSchemeEnrollment.STATUS_PENDING_ADMISSION,
    CustomerSchemeEnrollment.STATUS_PLAN_MONTH_COMPLETE,
)


def effective_rules(offering: JewellerSchemeOffering) -> dict:
    return offering.rules_snapshot or offering.scheme_template.scheme_rules or {}


def effective_design(offering: JewellerSchemeOffering) -> dict:
    return offering.design_snapshot or offering.scheme_template.scheme_design or {}


def sync_offering_snapshots_from_template(template: SchemeTemplate) -> int:
    """Refresh jeweller offering snapshots after a published template is edited."""
    design = template.scheme_design or {}
    rules = template.scheme_rules or compile_scheme_design(design)
    updated = 0
    for offering in JewellerSchemeOffering.objects.filter(scheme_template=template):
        offering.design_snapshot = design
        offering.rules_snapshot = rules
        offering.save(update_fields=["design_snapshot", "rules_snapshot"])
        updated += 1
    return updated


def customer_network_jeweller_ids(customer: User) -> list[int]:
    """Primary default jeweller plus secondary vault custodians, in display order."""
    ids: list[int] = []
    if customer.default_jeweller_id:
        ids.append(int(customer.default_jeweller_id))
    for sid in customer_secondary_jeweller_ids(customer):
        if sid not in ids:
            ids.append(sid)
    return ids


def resolve_verified_customer(
    *,
    customer_id: int | None = None,
    cridora_member_id: str | None = None,
    phone: str | None = None,
) -> User | None:
    qs = User.objects.filter(user_type=User.CUSTOMER, kyc_status=User.KYC_VERIFIED)
    if customer_id:
        return qs.filter(pk=customer_id).first()
    member = (cridora_member_id or "").strip().upper()
    if member.startswith("CRI"):
        return qs.filter(cridora_member_id__iexact=member).first()
    phone_raw = (phone or "").strip()
    if phone_raw:
        digits = normalize_phone_digits(phone_raw)
        if len(digits) >= 6:
            return qs.filter(phone__icontains=digits).first()
    return None


def assert_payments_allowed(enrollment: CustomerSchemeEnrollment) -> None:
    if enrollment.status != CustomerSchemeEnrollment.STATUS_ACTIVE:
        raise ValueError("Enrollment is not active.")
    if not enrollment.payments_enabled:
        raise ValueError(
            "Your jeweller must add you to this scheme before you can deposit."
        )


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


def _existing_open_enrollment(
    customer: User, offering: JewellerSchemeOffering
) -> CustomerSchemeEnrollment | None:
    return (
        CustomerSchemeEnrollment.objects.filter(
            customer=customer,
            offering=offering,
            status__in=OPEN_ENROLLMENT_STATUSES,
        )
        .order_by("-started_at")
        .first()
    )


def _create_enrollment(
    customer: User,
    offering: JewellerSchemeOffering,
    *,
    status: str,
    payments_enabled: bool,
    admitted_by: User | None = None,
) -> CustomerSchemeEnrollment:
    today = timezone.localdate()
    return CustomerSchemeEnrollment.objects.create(
        customer=customer,
        offering=offering,
        status=status,
        payments_enabled=payments_enabled,
        admitted_at=timezone.now() if payments_enabled else None,
        admitted_by=admitted_by if payments_enabled else None,
        design_snapshot=effective_design(offering),
        rules_snapshot=effective_rules(offering),
        cycle_anchor_date=today,
        current_plan_month=plan_month_for_date(
            CustomerSchemeEnrollment(cycle_anchor_date=today),
            today,
        ),
    )


@transaction.atomic
def enroll_customer(
    customer: User,
    offering: JewellerSchemeOffering,
) -> CustomerSchemeEnrollment:
    """Customer requests to join; jeweller must admit before deposits."""
    if offering.status != JewellerSchemeOffering.STATUS_ACTIVE:
        raise ValueError("Offering is not active.")
    existing = _existing_open_enrollment(customer, offering)
    if existing:
        return existing

    return _create_enrollment(
        customer,
        offering,
        status=CustomerSchemeEnrollment.STATUS_PENDING_ADMISSION,
        payments_enabled=False,
    )


@transaction.atomic
def jeweller_admit_customer(
    jeweller: User,
    offering: JewellerSchemeOffering,
    customer: User,
) -> CustomerSchemeEnrollment:
    """Jeweller adds a verified customer — enables scheme deposits."""
    if offering.jeweller_id != jeweller.id:
        raise ValueError("Offering does not belong to this jeweller.")
    if offering.status != JewellerSchemeOffering.STATUS_ACTIVE:
        raise ValueError("Offering is not active.")
    if customer.user_type != User.CUSTOMER or customer.kyc_status != User.KYC_VERIFIED:
        raise ValueError("Customer must be KYC verified.")

    pending = CustomerSchemeEnrollment.objects.filter(
        customer=customer,
        offering=offering,
        status=CustomerSchemeEnrollment.STATUS_PENDING_ADMISSION,
    ).first()
    if pending:
        pending.status = CustomerSchemeEnrollment.STATUS_ACTIVE
        pending.payments_enabled = True
        pending.admitted_at = timezone.now()
        pending.admitted_by = jeweller
        pending.save(
            update_fields=[
                "status",
                "payments_enabled",
                "admitted_at",
                "admitted_by",
            ]
        )
        return pending

    existing = CustomerSchemeEnrollment.objects.filter(
        customer=customer,
        offering=offering,
        status=CustomerSchemeEnrollment.STATUS_ACTIVE,
    ).first()
    if existing:
        if not existing.payments_enabled:
            existing.payments_enabled = True
            existing.admitted_at = timezone.now()
            existing.admitted_by = jeweller
            existing.save(
                update_fields=[
                    "payments_enabled",
                    "admitted_at",
                    "admitted_by",
                ]
            )
        return existing

    return _create_enrollment(
        customer,
        offering,
        status=CustomerSchemeEnrollment.STATUS_ACTIVE,
        payments_enabled=True,
        admitted_by=jeweller,
    )


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


def _customer_brief(user: User) -> dict:
    label = f"{user.first_name} {user.last_name}".strip() or (user.email or "")
    return {
        "id": user.id,
        "label": label,
        "cridora_member_id": user.cridora_member_id or "",
        "phone": user.phone or "",
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
        "payments_enabled": enrollment.payments_enabled,
        "admitted_at": (
            enrollment.admitted_at.isoformat() if enrollment.admitted_at else None
        ),
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


def serialize_enrollment_for_jeweller(enrollment: CustomerSchemeEnrollment) -> dict:
    payload = serialize_enrollment(enrollment)
    payload["customer"] = _customer_brief(enrollment.customer)
    return payload
