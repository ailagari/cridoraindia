"""Counter OTP for scheme contributions."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime

from django.conf import settings
from django.utils import timezone

from apps.accounts.services.platform_operational import fractional_counter_otp_ttl_timedelta
from apps.schemes.models import SchemeContribution, SchemeContributionCounterOtp

OTP_DIGITS = 6
MAX_FAILED_ATTEMPTS = 5


def _hash_otp(contribution_id: int, code: str) -> str:
    pepper = settings.SECRET_KEY.encode()
    raw = f"sc:{contribution_id}:{code}".encode() + pepper
    return hashlib.sha256(raw).hexdigest()


def _generate_numeric_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(OTP_DIGITS))


def issue_counter_otp(contribution: SchemeContribution) -> tuple[str, datetime]:
    if contribution.payment_method != SchemeContribution.PAY_COUNTER:
        raise ValueError("OTP applies only to counter payments.")
    if contribution.status != SchemeContribution.AWAITING_COUNTER:
        raise ValueError("Contribution is not awaiting counter verification.")
    code = _generate_numeric_code()
    expires_at = timezone.now() + fractional_counter_otp_ttl_timedelta()
    digest = _hash_otp(contribution.pk, code)
    SchemeContributionCounterOtp.objects.update_or_create(
        contribution=contribution,
        defaults={
            "otp_hash": digest,
            "expires_at": expires_at,
            "attempts": 0,
        },
    )
    return code, expires_at


def verify_counter_otp(contribution: SchemeContribution, raw_otp: str) -> tuple[bool, str]:
    cleaned = (raw_otp or "").strip().replace(" ", "")
    if not cleaned.isdigit() or len(cleaned) != OTP_DIGITS:
        return False, f"Enter the {OTP_DIGITS}-digit code from the customer's app."

    try:
        row = SchemeContributionCounterOtp.objects.select_for_update().get(
            contribution=contribution
        )
    except SchemeContributionCounterOtp.DoesNotExist:
        return False, "No OTP issued yet. Ask the customer to generate OTP after paying."

    if timezone.now() > row.expires_at:
        return False, "OTP expired. Ask the customer to generate a new code."

    if row.attempts >= MAX_FAILED_ATTEMPTS:
        return False, "Too many incorrect attempts. Customer must generate a new OTP."

    expected = _hash_otp(contribution.pk, cleaned)
    if not secrets.compare_digest(expected, row.otp_hash):
        SchemeContributionCounterOtp.objects.filter(pk=row.pk).update(
            attempts=row.attempts + 1
        )
        remaining = MAX_FAILED_ATTEMPTS - row.attempts - 1
        if remaining <= 0:
            return False, "Too many incorrect attempts. Customer must generate a new OTP."
        return False, f"Incorrect OTP. {remaining} attempt(s) left."

    return True, ""
