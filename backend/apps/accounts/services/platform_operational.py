"""Runtime operational settings (OTP TTL, fractional markup, GST rates, etc.)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from ..models import PlatformOperationalSettings

DEFAULT_GST_ON_GOLD_PERCENT = Decimal("3")
DEFAULT_GST_ON_MAKING_PERCENT = Decimal("18")


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


def fractional_markup_percent() -> Decimal:
    row = PlatformOperationalSettings.objects.filter(pk=1).first()
    if row is None:
        return Decimal("0")
    return Decimal(row.fractional_markup_percent)


def set_fractional_markup_percent(value: Decimal | str | float | int) -> Decimal:
    v = Decimal(str(value))
    if v < 0 or v > 100:
        raise ValueError("Fractional markup must be between 0 and 100 percent.")
    row = PlatformOperationalSettings.load()
    row.fractional_markup_percent = v
    row.save(update_fields=["fractional_markup_percent", "updated_at"])
    return v


def gst_on_gold_percent() -> Decimal:
    row = PlatformOperationalSettings.objects.filter(pk=1).only("gst_on_gold_percent").first()
    if row is None:
        return DEFAULT_GST_ON_GOLD_PERCENT
    return Decimal(row.gst_on_gold_percent)


def gst_on_making_percent() -> Decimal:
    row = PlatformOperationalSettings.objects.filter(pk=1).only("gst_on_making_percent").first()
    if row is None:
        return DEFAULT_GST_ON_MAKING_PERCENT
    return Decimal(row.gst_on_making_percent)


def platform_billing_tax_payload() -> dict[str, str]:
    return {
        "gst_on_gold_percent": str(gst_on_gold_percent()),
        "gst_on_making_percent": str(gst_on_making_percent()),
    }


def _validate_gst_percent(value: Decimal | str | float | int, label: str) -> Decimal:
    v = Decimal(str(value))
    if v < 0 or v > 100:
        raise ValueError(f"{label} must be between 0 and 100 percent.")
    return v


def set_gst_on_gold_percent(value: Decimal | str | float | int) -> Decimal:
    v = _validate_gst_percent(value, "GST on gold")
    row = PlatformOperationalSettings.load()
    row.gst_on_gold_percent = v
    row.save(update_fields=["gst_on_gold_percent", "updated_at"])
    return v


def set_gst_on_making_percent(value: Decimal | str | float | int) -> Decimal:
    v = _validate_gst_percent(value, "GST on making charge")
    row = PlatformOperationalSettings.load()
    row.gst_on_making_percent = v
    row.save(update_fields=["gst_on_making_percent", "updated_at"])
    return v
