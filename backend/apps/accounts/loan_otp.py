"""Settlement OTP for cash loan disbursement — customer shares code with jeweller after payout."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime

from django.conf import settings
from django.utils import timezone

from .models import GoldLoanOtp, GoldLoanRequest
from .services.platform_operational import fractional_counter_otp_ttl_timedelta

OTP_DIGITS = 6
MAX_FAILED_ATTEMPTS = 5


def _hash_otp(loan_id: int, code: str) -> str:
    pepper = settings.SECRET_KEY.encode()
    raw = f"loan:{loan_id}:{code}".encode() + pepper
    return hashlib.sha256(raw).hexdigest()


def _generate_numeric_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(OTP_DIGITS))


def issue_loan_otp(loan: GoldLoanRequest) -> tuple[str, datetime]:
    if loan.status != GoldLoanRequest.STATUS_PENDING_JEWELLER:
        raise ValueError("OTP can only be issued while awaiting jeweller review.")
    code = _generate_numeric_code()
    expires_at = timezone.now() + fractional_counter_otp_ttl_timedelta()
    digest = _hash_otp(loan.pk, code)
    GoldLoanOtp.objects.update_or_create(
        loan=loan,
        defaults={
            "code_hash": digest,
            "expires_at": expires_at,
            "failed_attempts": 0,
        },
    )
    return code, expires_at


def verify_loan_otp(loan: GoldLoanRequest, raw_otp: str) -> tuple[bool, str]:
    cleaned = (raw_otp or "").strip().replace(" ", "")
    if not cleaned.isdigit() or len(cleaned) != OTP_DIGITS:
        return False, f"Enter the {OTP_DIGITS}-digit code from the customer."

    try:
        row = GoldLoanOtp.objects.select_for_update().get(loan=loan)
    except GoldLoanOtp.DoesNotExist:
        return False, "No OTP on file. Ask the customer to regenerate OTP in their dashboard."

    if timezone.now() > row.expires_at:
        return False, "OTP expired. Customer must regenerate OTP."

    if row.failed_attempts >= MAX_FAILED_ATTEMPTS:
        return False, "Too many incorrect attempts. Customer must regenerate OTP."

    expected = _hash_otp(loan.pk, cleaned)
    if not secrets.compare_digest(expected, row.code_hash):
        GoldLoanOtp.objects.filter(pk=row.pk).update(failed_attempts=row.failed_attempts + 1)
        remaining = MAX_FAILED_ATTEMPTS - row.failed_attempts - 1
        if remaining <= 0:
            return False, "Too many incorrect attempts. Customer must regenerate OTP."
        return False, f"Incorrect OTP. {remaining} attempt(s) left."

    return True, ""
