"""Runtime operational settings (OTP TTL, etc.)."""

from __future__ import annotations

from datetime import timedelta

from ..models import PlatformOperationalSettings


def fractional_counter_otp_ttl_timedelta() -> timedelta:
    row = PlatformOperationalSettings.objects.filter(pk=1).first()
    if row is None:
        return timedelta(seconds=900)
    return timedelta(seconds=int(row.fractional_counter_otp_ttl_seconds))


def fractional_counter_otp_ttl_seconds_int() -> int:
    return int(fractional_counter_otp_ttl_timedelta().total_seconds())


def set_fractional_counter_otp_ttl_seconds(value: int) -> int:
    v = int(value)
    if v < 60 or v > 86400:
        raise ValueError("OTP validity must be between 60 and 86400 seconds.")
    row = PlatformOperationalSettings.load()
    row.fractional_counter_otp_ttl_seconds = v
    row.save(update_fields=["fractional_counter_otp_ttl_seconds", "updated_at"])
    return v
