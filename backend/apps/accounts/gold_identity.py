"""GoldUPI identity: username@jewellercode resolution and custodian routing."""

from __future__ import annotations

import re
from decimal import Decimal

from django.contrib.auth import get_user_model

User = get_user_model()

GOLD_HANDLE_LOCAL_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
JEWELLER_CODE_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,31}$")
CRIDORA_VAULT_ID_RE = re.compile(
    r"^([a-z0-9_]{3,32})\.([a-z0-9][a-z0-9-]{1,31})@cridora$"
)

MIN_TRANSFER_GRAMS = Decimal("0.000001")
MAX_TRANSFER_GRAMS = Decimal("999999.999999")


def normalize_cridora_vault_public_id(raw: str) -> str | None:
    s = (raw or "").strip().lower()
    if CRIDORA_VAULT_ID_RE.match(s):
        return s
    return None


def resolve_owner_by_vault_public_id(raw: str) -> User | None:
    from .models import GoldVault

    key = normalize_cridora_vault_public_id(raw)
    if not key:
        return None
    v = (
        GoldVault.objects.filter(vault_public_id__iexact=key)
        .select_related("owner")
        .first()
    )
    return v.owner if v else None


def normalize_gold_upi(raw: str) -> str | None:
    s = (raw or "").strip().lower()
    if s.count("@") != 1:
        return None
    local, _, code = s.partition("@")
    local = local.strip()
    code = code.strip()
    if not local or not code:
        return None
    return f"{local}@{code}"


def compute_gold_upi(user: User) -> str | None:
    local = (user.gold_handle_local or "").strip().lower()
    if not local or not GOLD_HANDLE_LOCAL_RE.match(local):
        return None
    if user.user_type == User.JEWELLER:
        code = (user.jeweller_code or "").strip().lower()
        if not code or not JEWELLER_CODE_RE.match(code):
            return None
        return f"{local}@{code}"
    if user.user_type != User.CUSTOMER:
        return None
    dj = user.default_jeweller
    if not dj:
        return None
    code = (dj.jeweller_code or "").strip().lower()
    if not code or not JEWELLER_CODE_RE.match(code):
        return None
    return f"{local}@{code}"


def resolve_user_by_gold_upi(raw: str) -> User | None:
    normalized = normalize_gold_upi(raw)
    if not normalized:
        return None
    return (
        User.objects.filter(gold_upi__iexact=normalized)
        .select_related("default_jeweller")
        .first()
    )


def effective_custodian(user: User) -> User | None:
    if user.user_type == User.JEWELLER:
        return user
    return user.default_jeweller


MAX_CASH_INR = Decimal("9999999999.99")


def parse_cash_inr(value) -> tuple[Decimal | None, str | None]:
    try:
        x = Decimal(str(value))
    except Exception:
        return None, "Invalid cash amount."
    if x <= 0:
        return None, "Enter a positive cash amount."
    if x != x.quantize(Decimal("0.01")):
        return None, "Use at most 2 decimal places for INR."
    if x > MAX_CASH_INR:
        return None, "Amount too large."
    return x, None


def parse_grams(value) -> tuple[Decimal | None, str | None]:
    try:
        g = Decimal(str(value))
    except Exception:
        return None, "Invalid gram amount."
    if g != g.quantize(Decimal("0.000001")):
        return None, "Use at most 6 decimal places."
    if g < MIN_TRANSFER_GRAMS:
        return None, f"Minimum transfer is {MIN_TRANSFER_GRAMS} g."
    if g > MAX_TRANSFER_GRAMS:
        return None, "Amount exceeds maximum."
    return g, None


def validate_jeweller_code(code: str) -> tuple[str | None, str | None]:
    c = (code or "").strip().lower()
    if not c or not JEWELLER_CODE_RE.match(c):
        return None, "Jeweller code must be 2–32 chars: lowercase letters, digits, hyphen; must start with alphanumeric."
    return c, None


def validate_handle_local(handle: str) -> tuple[str | None, str | None]:
    h = (handle or "").strip().lower()
    if not h or not GOLD_HANDLE_LOCAL_RE.match(h):
        return None, "Handle must be 3–32 chars: letters, digits, underscore."
    return h, None
