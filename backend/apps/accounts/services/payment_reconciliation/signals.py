"""Capture payment signals for reconciliation."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from django.utils import timezone

from apps.accounts.models import FractionalGoldPurchase, GoldLoanRepaymentRequest, PaymentSignal
from apps.accounts.services.fractional_upi import normalize_utr
from apps.accounts.services.payment_reconciliation.sms_parser import ParsedSMS, parse_sms


def capture_upi_intent_signal(purchase: FractionalGoldPurchase) -> PaymentSignal:
    return PaymentSignal.objects.create(
        fractional_purchase=purchase,
        amount_inr=purchase.total_inr,
        timestamp=timezone.now(),
        upi_vpa=purchase.payee_upi_vpa or "",
        source=PaymentSignal.SOURCE_UPI_INTENT,
        parsed_payload={"payment_note": purchase.payment_note or ""},
    )


def capture_user_input_signal(
    purchase: FractionalGoldPurchase,
    *,
    utr: str = "",
    amount_inr: Decimal | None = None,
    received_at: datetime | None = None,
) -> PaymentSignal:
    utr_norm = normalize_utr(utr) if utr else ""
    ts = received_at or timezone.now()
    if utr_norm:
        purchase.upi_utr = utr_norm
        purchase.utr_submitted_at = ts
        purchase.save(update_fields=["upi_utr", "utr_submitted_at", "updated_at"])
    return PaymentSignal.objects.create(
        fractional_purchase=purchase,
        amount_inr=amount_inr or purchase.total_inr,
        timestamp=ts,
        upi_vpa=purchase.payee_upi_vpa or "",
        utr=utr_norm or "",
        source=PaymentSignal.SOURCE_USER_INPUT,
    )


def capture_sms_signal(
    purchase: FractionalGoldPurchase,
    sms_text: str,
    *,
    received_at: datetime | None = None,
) -> PaymentSignal | None:
    parsed = parse_sms(sms_text)
    if parsed is None:
        return None
    ts = received_at or timezone.now()
    utr_norm = normalize_utr(parsed.utr) if parsed.utr else ""
    if utr_norm and not purchase.upi_utr:
        purchase.upi_utr = utr_norm
        purchase.utr_submitted_at = ts
        purchase.save(update_fields=["upi_utr", "utr_submitted_at", "updated_at"])
    return PaymentSignal.objects.create(
        fractional_purchase=purchase,
        amount_inr=parsed.amount_inr,
        timestamp=ts,
        upi_vpa=parsed.receiver_vpa or purchase.payee_upi_vpa or "",
        utr=utr_norm or "",
        sms_reference=parsed.raw_text,
        source=PaymentSignal.SOURCE_SMS_PARSE,
        parsed_payload={
            "receiver_vpa": parsed.receiver_vpa,
            "amount_inr": str(parsed.amount_inr) if parsed.amount_inr else None,
        },
    )


def capture_jeweller_confirmation_signal(
    purchase: FractionalGoldPurchase,
) -> PaymentSignal:
    return PaymentSignal.objects.create(
        fractional_purchase=purchase,
        amount_inr=purchase.total_inr,
        timestamp=timezone.now(),
        upi_vpa=purchase.payee_upi_vpa or "",
        utr=purchase.upi_utr or "",
        source=PaymentSignal.SOURCE_JEWELLER_CONFIRMATION,
    )


def ensure_payment_signal_at(purchase: FractionalGoldPurchase) -> None:
    if purchase.payment_signal_at is None:
        purchase.payment_signal_at = timezone.now()


def loan_payment_note_for(repayment_id: int) -> str:
    return f"Cridora LRP-{repayment_id}"


def capture_loan_user_input_signal(
    req: GoldLoanRepaymentRequest,
    *,
    utr: str = "",
    received_at: datetime | None = None,
) -> PaymentSignal:
    utr_norm = normalize_utr(utr) if utr else ""
    ts = received_at or timezone.now()
    if utr_norm:
        req.upi_utr = utr_norm
        req.utr_submitted_at = ts
        req.save(update_fields=["upi_utr", "utr_submitted_at", "updated_at"])
    return PaymentSignal.objects.create(
        loan_repayment=req,
        amount_inr=req.amount_inr,
        timestamp=ts,
        upi_vpa=req.payee_upi_vpa or "",
        utr=utr_norm or "",
        source=PaymentSignal.SOURCE_USER_INPUT,
    )


def capture_loan_sms_signal(
    req: GoldLoanRepaymentRequest,
    sms_text: str,
    *,
    received_at: datetime | None = None,
) -> PaymentSignal | None:
    parsed = parse_sms(sms_text)
    if parsed is None:
        return None
    ts = received_at or timezone.now()
    utr_norm = normalize_utr(parsed.utr) if parsed.utr else ""
    if utr_norm and not req.upi_utr:
        req.upi_utr = utr_norm
        req.utr_submitted_at = ts
        req.save(update_fields=["upi_utr", "utr_submitted_at", "updated_at"])
    return PaymentSignal.objects.create(
        loan_repayment=req,
        amount_inr=parsed.amount_inr,
        timestamp=ts,
        upi_vpa=parsed.receiver_vpa or req.payee_upi_vpa or "",
        utr=utr_norm or "",
        sms_reference=parsed.raw_text,
        source=PaymentSignal.SOURCE_SMS_PARSE,
        parsed_payload={
            "receiver_vpa": parsed.receiver_vpa,
            "amount_inr": str(parsed.amount_inr) if parsed.amount_inr else None,
        },
    )


def capture_loan_jeweller_confirmation_signal(
    req: GoldLoanRepaymentRequest,
) -> PaymentSignal:
    return PaymentSignal.objects.create(
        loan_repayment=req,
        amount_inr=req.amount_inr,
        timestamp=timezone.now(),
        upi_vpa=req.payee_upi_vpa or "",
        utr=req.upi_utr or "",
        source=PaymentSignal.SOURCE_JEWELLER_CONFIRMATION,
    )
