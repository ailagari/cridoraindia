"""In-app OTP issuance and verification for gold deposit intakes."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime

from django.conf import settings
from django.utils import timezone

from .models import GoldDepositCounterOtp, GoldDepositIntake
from .services.platform_operational import fractional_counter_otp_ttl_timedelta

OTP_DIGITS = 6
MAX_FAILED_ATTEMPTS = 5


def _hash_otp(intake_id: int, code: str) -> str:
    pepper = settings.SECRET_KEY.encode()
    raw = f"gd:{intake_id}:{code}".encode() + pepper
    return hashlib.sha256(raw).hexdigest()


def _generate_numeric_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(OTP_DIGITS))


def issue_gold_deposit_counter_otp(intake: GoldDepositIntake) -> tuple[str, datetime]:
    if intake.status != GoldDepositIntake.AWAITING_CUSTOMER_OTP:
        raise ValueError("This deposit is not awaiting OTP confirmation.")
    code = _generate_numeric_code()
    expires_at = timezone.now() + fractional_counter_otp_ttl_timedelta()
    digest = _hash_otp(intake.pk, code)
    GoldDepositCounterOtp.objects.update_or_create(
        intake=intake,
        defaults={
            "code_hash": digest,
            "expires_at": expires_at,
            "failed_attempts": 0,
        },
    )
    return code, expires_at


def verify_gold_deposit_counter_otp(intake: GoldDepositIntake, raw_otp: str) -> tuple[bool, str]:
    cleaned = (raw_otp or "").strip().replace(" ", "")
    if not cleaned.isdigit() or len(cleaned) != OTP_DIGITS:
        return False, f"Enter the {OTP_DIGITS}-digit code from the customer's app."

    try:
        row = GoldDepositCounterOtp.objects.select_for_update().get(intake=intake)
    except GoldDepositCounterOtp.DoesNotExist:
        return False, "No OTP issued yet. Ask the customer to generate a code in their app."

    if timezone.now() > row.expires_at:
        return False, "OTP expired. Ask the customer to generate a new code."

    if row.failed_attempts >= MAX_FAILED_ATTEMPTS:
        return False, "Too many incorrect attempts. Customer must generate a new OTP."

    expected = _hash_otp(intake.pk, cleaned)
    if not secrets.compare_digest(expected, row.code_hash):
        GoldDepositCounterOtp.objects.filter(pk=row.pk).update(
            failed_attempts=row.failed_attempts + 1
        )
        remaining = MAX_FAILED_ATTEMPTS - row.failed_attempts - 1
        if remaining <= 0:
            return False, "Too many incorrect attempts. Customer must generate a new OTP."
        return False, f"Incorrect OTP. {remaining} attempt(s) left."

    return True, ""
