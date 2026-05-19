"""UPI payout helpers for sellback (Model A reversed — jeweller pays customer, paste UTR)."""

from __future__ import annotations

from decimal import Decimal
from urllib.parse import quote

from django.utils import timezone

from ..models import GoldSellbackRequest, User
from .fractional_upi import (
    default_payment_expires_at,
    normalize_upi_vpa,
    normalize_utr,
)

PAYOUT_EXPIRY_MINUTES = 60


def payout_reference(sellback_id: int) -> str:
    return f"SB-{sellback_id}"


def payout_note_for(sellback_id: int) -> str:
    return f"Cridora {payout_reference(sellback_id)}"


def customer_payout_payee_name(customer: User) -> str:
    name = f"{customer.first_name} {customer.last_name}".strip()
    if name:
        return name[:80]
    return (customer.email or "Customer")[:80]


def build_sellback_payout_uri(
    *,
    vpa: str,
    payee_name: str,
    amount_inr: Decimal,
    sellback_id: int,
) -> str:
    ref = payout_reference(sellback_id)
    note = payout_note_for(sellback_id)
    amount = format(amount_inr.quantize(Decimal("0.01")), "f")
    query = (
        f"pa={quote(vpa)}"
        f"&pn={quote(payee_name[:80])}"
        f"&am={amount}"
        f"&cu=INR"
        f"&tn={quote(note)}"
        f"&tr={quote(ref)}"
    )
    return f"upi://pay?{query}"


def is_payout_expired(row: GoldSellbackRequest) -> bool:
    if row.payout_expires_at is None:
        return False
    return timezone.now() > row.payout_expires_at


def utr_already_used(utr: str, *, exclude_sellback_id: int | None = None) -> bool:
    qs = GoldSellbackRequest.objects.filter(upi_utr=utr).exclude(
        status=GoldSellbackRequest.STATUS_CANCELLED
    )
    if exclude_sellback_id is not None:
        qs = qs.exclude(pk=exclude_sellback_id)
    return qs.exists()


def payout_payload_for(row: GoldSellbackRequest) -> dict:
    vpa = (row.payout_upi_vpa or "").strip()
    payee = customer_payout_payee_name(row.customer)
    return {
        "reference": payout_reference(row.id),
        "payee_vpa": vpa,
        "payee_name": payee,
        "amount_inr": str(row.cash_estimate_inr),
        "payment_note": row.payment_note or payout_note_for(row.id),
        "upi_uri": build_sellback_payout_uri(
            vpa=vpa,
            payee_name=payee,
            amount_inr=row.cash_estimate_inr,
            sellback_id=row.id,
        ),
        "payout_expires_at": row.payout_expires_at.isoformat()
        if row.payout_expires_at
        else None,
        "expired": is_payout_expired(row),
    }


def cancel_upi_sellback(row: GoldSellbackRequest) -> tuple[bool, str]:
    if row.payment_method != GoldSellbackRequest.PAY_UPI:
        return False, "This is not a UPI sellback."
    if row.status != GoldSellbackRequest.STATUS_PENDING_JEWELLER:
        return False, "Only pending sellbacks can be cancelled."
    row.status = GoldSellbackRequest.STATUS_CANCELLED
    row.save(update_fields=["status", "updated_at"])
    return True, "Sellback cancelled."


def submit_utr_for_jeweller(row: GoldSellbackRequest, raw_utr: str) -> tuple[bool, str]:
    if row.payment_method != GoldSellbackRequest.PAY_UPI:
        return False, "This is not a UPI sellback."
    if row.status != GoldSellbackRequest.STATUS_ACCEPTED_AWAITING_OTP:
        return False, "Accept the sellback before submitting UTR."
    if is_payout_expired(row):
        return False, "Payout window expired. Ask the customer to submit a new request."
    utr = normalize_utr(raw_utr)
    if not utr:
        return False, "Enter a valid UPI reference (8–20 letters or digits)."
    if utr_already_used(utr, exclude_sellback_id=row.pk):
        return False, "This UPI reference is already linked to another sellback."
    row.upi_utr = utr
    row.utr_submitted_at = timezone.now()
    row.status = GoldSellbackRequest.STATUS_AWAITING_UTR_VERIFY
    row.save(update_fields=["upi_utr", "utr_submitted_at", "status", "updated_at"])
    return True, "UTR submitted. Waiting for customer confirmation."


def confirm_utr_for_customer(row: GoldSellbackRequest, customer: User) -> tuple[bool, str]:
    if row.customer_id != customer.pk:
        return False, "Sellback not found."
    if row.payment_method != GoldSellbackRequest.PAY_UPI:
        return False, "Not a UPI sellback."
    if row.status != GoldSellbackRequest.STATUS_AWAITING_UTR_VERIFY:
        return False, "Sellback is not awaiting UTR confirmation."
    if not row.upi_utr:
        return False, "No UTR on this sellback."
    return True, "OK"
