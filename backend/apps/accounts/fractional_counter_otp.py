"""In-app OTP issuance and verification for counter fractional purchases."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone

from .models import FractionalCounterOtp, FractionalGoldPurchase

OTP_DIGITS = 6
OTP_TTL = timedelta(minutes=15)
MAX_FAILED_ATTEMPTS = 5


def _hash_otp(purchase_id: int, code: str) -> str:
    pepper = settings.SECRET_KEY.encode()
    raw = f"{purchase_id}:{code}".encode() + pepper
    return hashlib.sha256(raw).hexdigest()


def _generate_numeric_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(OTP_DIGITS))


def issue_counter_otp(purchase: FractionalGoldPurchase) -> tuple[str, datetime]:
    if purchase.payment_method != FractionalGoldPurchase.PAY_COUNTER:
        raise ValueError("OTP applies only to counter purchases.")
    if purchase.status != FractionalGoldPurchase.AWAITING_COUNTER:
        raise ValueError("Order is not awaiting counter verification.")
    code = _generate_numeric_code()
    expires_at = timezone.now() + OTP_TTL
    digest = _hash_otp(purchase.pk, code)
    FractionalCounterOtp.objects.update_or_create(
        purchase=purchase,
        defaults={
            "code_hash": digest,
            "expires_at": expires_at,
            "failed_attempts": 0,
        },
    )
    return code, expires_at


def verify_counter_otp(purchase: FractionalGoldPurchase, raw_otp: str) -> tuple[bool, str]:
    """
    Returns (ok, detail). On failure, increments failed_attempts when OTP row exists.
    """
    cleaned = (raw_otp or "").strip().replace(" ", "")
    if not cleaned.isdigit() or len(cleaned) != OTP_DIGITS:
        return False, f"Enter the {OTP_DIGITS}-digit code from the customer's app."

    try:
        row = FractionalCounterOtp.objects.select_for_update().get(purchase=purchase)
    except FractionalCounterOtp.DoesNotExist:
        return False, "No OTP issued yet. Ask the customer to tap Generate OTP after paying."

    if timezone.now() > row.expires_at:
        return False, "OTP expired. Ask the customer to generate a new code."

    if row.failed_attempts >= MAX_FAILED_ATTEMPTS:
        return False, "Too many incorrect attempts. Customer must generate a new OTP."

    expected = _hash_otp(purchase.pk, cleaned)
    if not secrets.compare_digest(expected, row.code_hash):
        FractionalCounterOtp.objects.filter(pk=row.pk).update(
            failed_attempts=row.failed_attempts + 1
        )
        remaining = MAX_FAILED_ATTEMPTS - row.failed_attempts - 1
        if remaining <= 0:
            return False, "Too many incorrect attempts. Customer must generate a new OTP."
        return False, f"Incorrect OTP. {remaining} attempt(s) left."

    return True, ""
