"""Source-jeweller OTP for manual cross-redemption approval."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone

from apps.accounts.models import CrossRedemptionApprovalOtp, CrossRedemptionRequest

OTP_DIGITS = 6
MAX_FAILED_ATTEMPTS = 5


def _hash_otp(request_id: int, code: str) -> str:
    pepper = settings.SECRET_KEY.encode()
    raw = f"cross_redemption:{request_id}:{code}".encode() + pepper
    return hashlib.sha256(raw).hexdigest()


def _generate_numeric_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(OTP_DIGITS))


def issue_cross_redemption_source_otp(
    req: CrossRedemptionRequest,
    *,
    ttl_minutes: int = 15,
) -> tuple[str, datetime]:
    if req.workflow_state != CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE:
        raise ValueError("OTP only while awaiting source approval.")
    code = _generate_numeric_code()
    expires_at = timezone.now() + timedelta(minutes=max(1, ttl_minutes))
    CrossRedemptionApprovalOtp.objects.update_or_create(
        request=req,
        defaults={
            "code_hash": _hash_otp(req.pk, code),
            "expires_at": expires_at,
            "failed_attempts": 0,
        },
    )
    return code, expires_at


def verify_cross_redemption_source_otp(
    req: CrossRedemptionRequest, raw_otp: str
) -> tuple[bool, str]:
    cleaned = (raw_otp or "").strip().replace(" ", "")
    if not cleaned.isdigit() or len(cleaned) != OTP_DIGITS:
        return False, f"Enter the {OTP_DIGITS}-digit approval code."

    try:
        row = CrossRedemptionApprovalOtp.objects.select_for_update().get(request=req)
    except CrossRedemptionApprovalOtp.DoesNotExist:
        return False, "Request an approval code first, then enter it here."

    if timezone.now() > row.expires_at:
        return False, "Code expired. Request a new one."

    if row.failed_attempts >= MAX_FAILED_ATTEMPTS:
        return False, "Too many attempts. Request a new code."

    expected = _hash_otp(req.pk, cleaned)
    if not secrets.compare_digest(expected, row.code_hash):
        CrossRedemptionApprovalOtp.objects.filter(pk=row.pk).update(
            failed_attempts=row.failed_attempts + 1
        )
        remaining = MAX_FAILED_ATTEMPTS - row.failed_attempts - 1
        if remaining <= 0:
            return False, "Too many attempts. Request a new code."
        return False, f"Incorrect code. {remaining} attempt(s) left."

    return True, ""
