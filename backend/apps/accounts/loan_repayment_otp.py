"""Settlement OTP for cash loan repayment — customer shares code with jeweller after paying."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime

from django.conf import settings
from django.utils import timezone

from .models import GoldLoanRepaymentOtp, GoldLoanRepaymentRequest
from .services.platform_operational import fractional_counter_otp_ttl_timedelta

OTP_DIGITS = 6
MAX_FAILED_ATTEMPTS = 5


def _hash_otp(repayment_request_id: int, code: str) -> str:
    pepper = settings.SECRET_KEY.encode()
    raw = f"loan_repay:{repayment_request_id}:{code}".encode() + pepper
    return hashlib.sha256(raw).hexdigest()


def _generate_numeric_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(OTP_DIGITS))


def issue_loan_repayment_otp(repayment_request: GoldLoanRepaymentRequest) -> tuple[str, datetime]:
    if repayment_request.status not in (
        GoldLoanRepaymentRequest.STATUS_PENDING_JEWELLER,
        GoldLoanRepaymentRequest.STATUS_ACCEPTED_AWAITING_OTP,
    ):
        raise ValueError("OTP can only be issued for an open repayment request.")
    code = _generate_numeric_code()
    expires_at = timezone.now() + fractional_counter_otp_ttl_timedelta()
    digest = _hash_otp(repayment_request.pk, code)
    GoldLoanRepaymentOtp.objects.update_or_create(
        repayment_request=repayment_request,
        defaults={
            "code_hash": digest,
            "expires_at": expires_at,
            "failed_attempts": 0,
        },
    )
    return code, expires_at


def verify_loan_repayment_otp(
    repayment_request: GoldLoanRepaymentRequest, raw_otp: str
) -> tuple[bool, str]:
    cleaned = (raw_otp or "").strip().replace(" ", "")
    if not cleaned.isdigit() or len(cleaned) != OTP_DIGITS:
        return False, f"Enter the {OTP_DIGITS}-digit code from the customer."

    try:
        row = GoldLoanRepaymentOtp.objects.select_for_update().get(
            repayment_request=repayment_request
        )
    except GoldLoanRepaymentOtp.DoesNotExist:
        return False, "No OTP on file. Ask the customer to regenerate OTP in their dashboard."

    if timezone.now() > row.expires_at:
        return False, "OTP expired. Customer must regenerate OTP."

    if row.failed_attempts >= MAX_FAILED_ATTEMPTS:
        return False, "Too many incorrect attempts. Customer must regenerate OTP."

    expected = _hash_otp(repayment_request.pk, cleaned)
    if not secrets.compare_digest(expected, row.code_hash):
        GoldLoanRepaymentOtp.objects.filter(pk=row.pk).update(
            failed_attempts=row.failed_attempts + 1
        )
        remaining = MAX_FAILED_ATTEMPTS - row.failed_attempts - 1
        if remaining <= 0:
            return False, "Too many incorrect attempts. Customer must regenerate OTP."
        return False, f"Incorrect OTP. {remaining} attempt(s) left."

    return True, ""
