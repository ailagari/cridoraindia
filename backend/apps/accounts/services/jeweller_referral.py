"""Jeweller 6-digit referral codes and customer onboarding (primary jeweller)."""

from __future__ import annotations

import secrets

from django.contrib.auth import get_user_model

User = get_user_model()

REFERRAL_CODE_LEN = 6
_MAX_ALLOC_ATTEMPTS = 64


def normalize_referral_code(raw: str | None) -> str | None:
    """Digits only, left-padded to 6 (e.g. 42891 → 042891)."""
    digits = "".join(c for c in (raw or "") if c.isdigit())
    if not digits or len(digits) > REFERRAL_CODE_LEN:
        return None
    return digits.zfill(REFERRAL_CODE_LEN)


def _verified_jeweller_by_id(jeweller_id: int) -> User | None:
    return User.objects.filter(
        pk=jeweller_id,
        user_type=User.JEWELLER,
        kyc_status=User.KYC_VERIFIED,
    ).first()


def resolve_onboarding_jeweller(
    *,
    referral_code: str | None = None,
    jeweller_id: int | None = None,
) -> tuple[User | None, str | None]:
    """
    Resolve a verified jeweller for customer onboarding.
    Returns (jeweller, error_message). error_message only when input was given but invalid.
    """
    has_ref = bool((referral_code or "").strip())
    has_id = jeweller_id is not None and jeweller_id > 0
    if not has_ref and not has_id:
        return None, None

    if has_ref:
        code = normalize_referral_code(referral_code)
        if not code:
            return None, "Referral code must be 6 digits."
        jeweller = User.objects.filter(
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_referral_code=code,
        ).first()
        if not jeweller:
            return None, "Referral code not found."
        return jeweller, None

    jeweller = _verified_jeweller_by_id(int(jeweller_id))
    if not jeweller:
        return None, "Jeweller not found."
    return jeweller, None


def ensure_jeweller_referral_code(jeweller: User) -> str | None:
    """Assign a unique 6-digit code when jeweller is KYB-verified."""
    if jeweller.user_type != User.JEWELLER:
        return None
    if jeweller.kyc_status != User.KYC_VERIFIED:
        return None
    existing = (jeweller.jeweller_referral_code or "").strip()
    if len(existing) == REFERRAL_CODE_LEN and existing.isdigit():
        return existing
    for _ in range(_MAX_ALLOC_ATTEMPTS):
        code = "".join(secrets.choice("0123456789") for _ in range(REFERRAL_CODE_LEN))
        if User.objects.filter(jeweller_referral_code=code).exists():
            continue
        User.objects.filter(pk=jeweller.pk).update(jeweller_referral_code=code)
        jeweller.jeweller_referral_code = code
        return code
    raise RuntimeError("Could not allocate a unique jeweller referral code.")


def referral_preview_payload(code: str) -> dict | None:
    """Public signup preview for a referral code."""
    normalized = normalize_referral_code(code)
    if not normalized:
        return None
    jeweller = User.objects.filter(
        user_type=User.JEWELLER,
        kyc_status=User.KYC_VERIFIED,
        jeweller_referral_code=normalized,
    ).first()
    if not jeweller:
        return None
    label = (jeweller.business_name or jeweller.email or "").strip()
    return {
        "valid": True,
        "referral_code": normalized,
        "jeweller_id": jeweller.id,
        "business_name": label,
        "city": (jeweller.city or "").strip(),
        "state": (jeweller.state or "").strip(),
    }


def apply_customer_onboarding_jeweller(
    customer: User,
    *,
    referral_code: str | None = None,
    jeweller_id: int | None = None,
) -> str | None:
    """
    Set default + onboarded_by jeweller on new customer signup.
    Returns a warning string if referral/jeweller id was provided but invalid (signup still succeeds).
    """
    if customer.user_type != User.CUSTOMER:
        return None
    jeweller, err = resolve_onboarding_jeweller(
        referral_code=referral_code,
        jeweller_id=jeweller_id,
    )
    if err:
        return err
    if not jeweller:
        return None
    customer.default_jeweller = jeweller
    customer.onboarded_by_jeweller = jeweller
    customer.save(
        update_fields=["default_jeweller", "onboarded_by_jeweller"],
    )
    return None


def customer_secondary_jeweller_ids(customer: User) -> list[int]:
    """Vault custodians with financial engagement, excluding primary default."""
    if customer.user_type != User.CUSTOMER:
        return []
    from ..models import GoldVault

    primary_id = customer.default_jeweller_id
    ids = {
        int(jid)
        for jid in GoldVault.objects.filter(owner=customer)
        .values_list("custodian_id", flat=True)
        .distinct()
        if jid
    }
    if primary_id:
        ids.discard(int(primary_id))
    return sorted(ids)
