"""UPI helpers for scheme contributions."""

from __future__ import annotations

from decimal import Decimal

from django.utils import timezone

from apps.accounts.services.fractional_upi import (
    build_upi_pay_uri,
    default_payment_expires_at,
    jeweller_upi_payee_name,
    jeweller_upi_vpa,
)
from apps.schemes.models import SchemeContribution


def payment_reference(contribution_id: int) -> str:
    return f"SC-{contribution_id}"


def payment_payload_for(contribution: SchemeContribution) -> dict:
    jeweller = contribution.jeweller
    vpa = (contribution.payee_upi_vpa or jeweller_upi_vpa(jeweller) or "").strip()
    payee = jeweller_upi_payee_name(jeweller)
    ref = payment_reference(contribution.id)
    note = contribution.payment_note or f"Cridora {ref}"
    return {
        "reference": ref,
        "order_reference": ref,
        "payee_vpa": vpa,
        "payee_name": payee,
        "amount_inr": str(contribution.amount_inr),
        "payment_note": note,
        "upi_uri": build_upi_pay_uri(
            vpa=vpa,
            payee_name=payee,
            amount_inr=contribution.amount_inr,
            purchase_id=contribution.id,
            transaction_ref=ref,
            payment_note=note,
        ),
        "payment_expires_at": (
            contribution.payment_expires_at.isoformat()
            if contribution.payment_expires_at
            else None
        ),
        "expired": is_contribution_payment_expired(contribution),
    }


def is_contribution_payment_expired(contribution: SchemeContribution) -> bool:
    if contribution.payment_expires_at is None:
        return False
    return timezone.now() > contribution.payment_expires_at


def submit_utr(contribution: SchemeContribution, raw_utr: str) -> tuple[bool, str]:
    if contribution.payment_method != SchemeContribution.PAY_UPI:
        return False, "This contribution is not an online UPI payment."
    if is_contribution_payment_expired(contribution):
        return False, "Payment window expired. Create a new contribution."
    from apps.accounts.services.upi_manual_payment.registry import KIND_SCHEME
    from apps.accounts.services.upi_manual_payment.submit import submit_utr as manual_submit

    payer = contribution.customer
    out, err = manual_submit(KIND_SCHEME, contribution, payer, raw_utr)
    if err:
        return False, err
    if out and out.get("is_completed"):
        return True, "Payment confirmed."
    return True, "Payment submitted. Awaiting jeweller review."
