"""OTP issuance and verification for offline platform settlement payments."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import PlatformSettlementOtp, PlatformSettlementPayment
from apps.accounts.services.admin_access import user_is_platform_admin
from apps.accounts.services.platform_operational import fractional_counter_otp_ttl_timedelta
from apps.accounts.services.settlement_payment_service import confirm_settlement_payment

User = get_user_model()

OTP_DIGITS = 6
MAX_FAILED_ATTEMPTS = 5


def _hash_otp(payment_id: int, code: str) -> str:
    pepper = settings.SECRET_KEY.encode()
    raw = f"settlement:{payment_id}:{code}".encode() + pepper
    return hashlib.sha256(raw).hexdigest()


def _generate_numeric_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(OTP_DIGITS))


def _is_payer(user: User, payment: PlatformSettlementPayment) -> bool:
    if payment.direction == PlatformSettlementPayment.DIR_JEWELLER_TO_PLATFORM:
        return user.user_type == User.JEWELLER and payment.jeweller_id == user.pk
    if payment.direction == PlatformSettlementPayment.DIR_PLATFORM_TO_JEWELLER:
        return user_is_platform_admin(user)
    return False


def _is_receiver(user: User, payment: PlatformSettlementPayment) -> bool:
    if payment.direction == PlatformSettlementPayment.DIR_JEWELLER_TO_PLATFORM:
        return user_is_platform_admin(user)
    if payment.direction == PlatformSettlementPayment.DIR_PLATFORM_TO_JEWELLER:
        return user.user_type == User.JEWELLER and payment.jeweller_id == user.pk
    return False


def issue_settlement_otp(payment: PlatformSettlementPayment, user: User) -> tuple[str | None, datetime | None, str | None]:
    if payment.payment_method != PlatformSettlementPayment.PAY_OTP:
        return None, None, "This payment is not an OTP settlement."
    if not _is_payer(user, payment):
        return None, None, "Not allowed to issue OTP for this payment."
    if payment.status not in (
        PlatformSettlementPayment.STATUS_PENDING_PROOF,
        PlatformSettlementPayment.STATUS_REJECTED,
    ):
        return None, None, "Payment is not awaiting OTP issuance."

    code = _generate_numeric_code()
    expires_at = timezone.now() + fractional_counter_otp_ttl_timedelta()
    digest = _hash_otp(payment.pk, code)
    with transaction.atomic():
        locked = PlatformSettlementPayment.objects.select_for_update().get(pk=payment.pk)
        if locked.status not in (
            PlatformSettlementPayment.STATUS_PENDING_PROOF,
            PlatformSettlementPayment.STATUS_REJECTED,
        ):
            return None, None, "Payment is not awaiting OTP issuance."
        PlatformSettlementOtp.objects.update_or_create(
            payment=locked,
            defaults={
                "code_hash": digest,
                "expires_at": expires_at,
                "failed_attempts": 0,
                "verified_at": None,
            },
        )
        locked.status = PlatformSettlementPayment.STATUS_SUBMITTED
        locked.save(update_fields=["status"])
    return code, expires_at, None


def verify_settlement_otp(
    payment: PlatformSettlementPayment, user: User, raw_otp: str
) -> tuple[bool, str]:
    if payment.payment_method != PlatformSettlementPayment.PAY_OTP:
        return False, "This payment is not an OTP settlement."
    if not _is_receiver(user, payment):
        return False, "Not allowed to verify OTP for this payment."
    if payment.status != PlatformSettlementPayment.STATUS_SUBMITTED:
        return False, "Payment is not awaiting OTP verification."

    cleaned = (raw_otp or "").strip().replace(" ", "")
    if not cleaned.isdigit() or len(cleaned) != OTP_DIGITS:
        return False, f"Enter the {OTP_DIGITS}-digit code from the payer."

    with transaction.atomic():
        locked = PlatformSettlementPayment.objects.select_for_update().get(pk=payment.pk)
        if locked.status != PlatformSettlementPayment.STATUS_SUBMITTED:
            return False, "Payment is not awaiting OTP verification."
        try:
            row = PlatformSettlementOtp.objects.select_for_update().get(payment=locked)
        except PlatformSettlementOtp.DoesNotExist:
            return False, "No OTP issued yet. Ask the payer to generate a code."

        if timezone.now() > row.expires_at:
            return False, "OTP expired. Payer must generate a new code."

        if row.failed_attempts >= MAX_FAILED_ATTEMPTS:
            return False, "Too many incorrect attempts. Payer must generate a new OTP."

        expected = _hash_otp(locked.pk, cleaned)
        if not secrets.compare_digest(expected, row.code_hash):
            PlatformSettlementOtp.objects.filter(pk=row.pk).update(
                failed_attempts=row.failed_attempts + 1
            )
            remaining = MAX_FAILED_ATTEMPTS - row.failed_attempts - 1
            if remaining <= 0:
                return False, "Too many incorrect attempts. Payer must generate a new OTP."
            return False, f"Incorrect OTP. {remaining} attempt(s) left."

        row.verified_at = timezone.now()
        row.save(update_fields=["verified_at"])
        confirm_settlement_payment(locked, user)

    return True, ""
