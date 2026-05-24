"""UPI pay-at-jeweller helpers for fractional orders (Model A — paste UTR)."""

from __future__ import annotations

import re
from datetime import timedelta
from decimal import Decimal
from urllib.parse import quote

from django.utils import timezone

from apps.marketplace.models import jeweller_profile_for

from ..models import FractionalGoldPurchase

UPI_VPA_RE = re.compile(r"^[a-z0-9._-]+@[a-z0-9._-]+$", re.I)
UTR_MIN_LEN = 8
UTR_MAX_LEN = 20
PAYMENT_EXPIRY_MINUTES = 60


def normalize_upi_vpa(raw: str) -> str | None:
    s = (raw or "").strip().lower()
    if not s or len(s) > 128 or not UPI_VPA_RE.match(s):
        return None
    return s


def normalize_utr(raw: str) -> str | None:
    s = re.sub(r"[^A-Za-z0-9]", "", (raw or "").strip()).upper()
    if len(s) < UTR_MIN_LEN or len(s) > UTR_MAX_LEN:
        return None
    if not re.fullmatch(r"[A-Z0-9]+", s):
        return None
    return s


def utr_validation_error(raw: str) -> str | None:
    """Return user-facing error when raw UTR text cannot be normalized."""
    if not (raw or "").strip():
        return None
    if normalize_utr(raw):
        return None
    return "Enter a valid UTR number (8–20 letters or digits)."


def jeweller_upi_vpa(jeweller) -> str | None:
    profile = jeweller_profile_for(jeweller)
    return normalize_upi_vpa(profile.upi_vpa or "")


def jeweller_upi_payee_name(jeweller) -> str:
    profile = jeweller_profile_for(jeweller)
    custom = (profile.upi_display_name or "").strip()
    if custom:
        return custom[:80]
    return (jeweller.business_name or jeweller.email or "Jeweller")[:80]


def payment_reference(purchase_id: int) -> str:
    return f"FR-{purchase_id}"


def order_reference_cr(purchase_id: int) -> str:
    return f"CR-{purchase_id}"


def payment_note_for(purchase_id: int) -> str:
    return f"Cridora {order_reference_cr(purchase_id)}"


def build_upi_pay_uri(
    *,
    vpa: str,
    payee_name: str,
    amount_inr: Decimal,
    purchase_id: int,
    transaction_ref: str | None = None,
    payment_note: str | None = None,
) -> str:
    ref = transaction_ref or payment_reference(purchase_id)
    note = payment_note or payment_note_for(purchase_id)
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


def build_loan_repayment_upi_uri(
    *,
    vpa: str,
    payee_name: str,
    amount_inr: Decimal,
    repayment_id: int,
) -> str:
    ref = f"LRP-{repayment_id}"
    note = f"Cridora {ref}"
    return build_upi_pay_uri(
        vpa=vpa,
        payee_name=payee_name,
        amount_inr=amount_inr,
        purchase_id=repayment_id,
        transaction_ref=ref,
        payment_note=note,
    )


def default_payment_expires_at():
    return timezone.now() + timedelta(minutes=PAYMENT_EXPIRY_MINUTES)


def is_payment_expired(purchase: FractionalGoldPurchase) -> bool:
    if purchase.payment_expires_at is None:
        return False
    return timezone.now() > purchase.payment_expires_at


def utr_already_used(
    utr: str,
    *,
    exclude_purchase_id: int | None = None,
    exclude_repayment_id: int | None = None,
) -> bool:
    from ..models import GoldLoanRepaymentRequest

    qs = FractionalGoldPurchase.objects.filter(upi_utr=utr).exclude(
        status=FractionalGoldPurchase.CANCELLED
    )
    if exclude_purchase_id is not None:
        qs = qs.exclude(pk=exclude_purchase_id)
    if qs.exists():
        return True
    lr_qs = GoldLoanRepaymentRequest.objects.filter(upi_utr=utr).exclude(
        status=GoldLoanRepaymentRequest.STATUS_CANCELLED
    )
    if exclude_repayment_id is not None:
        lr_qs = lr_qs.exclude(pk=exclude_repayment_id)
    return lr_qs.exists()


def payment_payload_for(purchase: FractionalGoldPurchase) -> dict:
    vpa = (purchase.payee_upi_vpa or "").strip()
    payee = jeweller_upi_payee_name(purchase.jeweller)
    return {
        "reference": payment_reference(purchase.id),
        "order_reference": order_reference_cr(purchase.id),
        "payee_vpa": vpa,
        "payee_name": payee,
        "amount_inr": str(purchase.total_inr),
        "payment_note": purchase.payment_note or payment_note_for(purchase.id),
        "upi_uri": build_upi_pay_uri(
            vpa=vpa,
            payee_name=payee,
            amount_inr=purchase.total_inr,
            purchase_id=purchase.id,
        ),
        "payment_expires_at": purchase.payment_expires_at.isoformat()
        if purchase.payment_expires_at
        else None,
        "expired": is_payment_expired(purchase),
    }


def cancel_upi_order(purchase: FractionalGoldPurchase) -> tuple[bool, str]:
    if purchase.payment_method != FractionalGoldPurchase.PAY_UPI:
        return False, "This order is not an online UPI purchase."
    if purchase.status not in (
        FractionalGoldPurchase.PENDING_PAYMENT,
        FractionalGoldPurchase.SIGNAL_RECEIVED,
    ):
        return False, "Only unpaid orders can be cancelled."
    purchase.status = FractionalGoldPurchase.CANCELLED
    purchase.save(update_fields=["status", "updated_at"])
    return True, "Order cancelled."


def submit_utr(purchase: FractionalGoldPurchase, raw_utr: str) -> tuple[bool, str]:
    if purchase.payment_method != FractionalGoldPurchase.PAY_UPI:
        return False, "This order is not an online UPI purchase."
    if is_payment_expired(purchase):
        return False, "Payment window expired. Place a new order."
    from apps.accounts.services.upi_manual_payment.registry import KIND_FRACTIONAL
    from apps.accounts.services.upi_manual_payment.submit import submit_utr as manual_submit

    payer = purchase.customer
    out, err = manual_submit(KIND_FRACTIONAL, purchase, payer, raw_utr)
    if err:
        return False, err
    if out and out.get("is_completed"):
        return True, "Payment confirmed. Gold credited to your vault."
    return True, "Payment submitted. Awaiting jeweller review."


def confirm_utr_for_jeweller(purchase: FractionalGoldPurchase, jeweller) -> tuple[bool, str]:
    if purchase.jeweller_id != jeweller.pk:
        return False, "Order not found."
    if purchase.payment_method != FractionalGoldPurchase.PAY_UPI:
        return False, "Not an online UPI order."
    if purchase.status != FractionalGoldPurchase.AWAITING_UTR_VERIFY:
        return False, "Order is not awaiting UTR verification."
    if not purchase.upi_utr:
        return False, "No UTR on this order."
    return True, "OK"
