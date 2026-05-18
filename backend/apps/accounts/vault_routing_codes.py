"""Random vault routing codes (card-style) — not derived from handles or jeweller slugs."""

from __future__ import annotations

import re
import secrets

from django.contrib.auth import get_user_model

User = get_user_model()

ROUTING_CODE_DIGITS = 10
ROUTING_SUFFIX = "@cridora"
CRIDORA_ROUTING_CARD_RE = re.compile(rf"^([0-9]{{{ROUTING_CODE_DIGITS}}})@cridora$")
# Legacy predictable IDs (pre-migration); still resolvable if present in DB.
CRIDORA_VAULT_LEGACY_RE = re.compile(
    r"^([a-z0-9_]{3,32})\.([a-z0-9][a-z0-9-]{1,31})@cridora$"
)
CRIDORA_PRIMARY_LEGACY_RE = re.compile(r"^([a-z0-9_]{3,32})@cridora$")

_MAX_ALLOC_ATTEMPTS = 48


def format_routing_address(digits: str) -> str:
    return f"{digits}{ROUTING_SUFFIX}"


def routing_digits_from_address(address: str | None) -> str | None:
    if not address:
        return None
    m = CRIDORA_ROUTING_CARD_RE.match((address or "").strip().lower())
    return m.group(1) if m else None


def normalize_routing_address(raw: str) -> str | None:
    """Card-style `1234567890@cridora` only (lowercase suffix)."""
    s = (raw or "").strip().lower()
    if CRIDORA_ROUTING_CARD_RE.match(s):
        return s
    return None


def normalize_legacy_vault_public_id(raw: str) -> str | None:
    s = (raw or "").strip().lower()
    if CRIDORA_VAULT_LEGACY_RE.match(s):
        return s
    return None


def _code_in_use(digits: str) -> bool:
    from .models import GoldVault

    addr = format_routing_address(digits)
    if GoldVault.objects.filter(vault_public_id__iexact=addr).exists():
        return True
    if User.objects.filter(gold_routing_code=digits).exists():
        return True
    return False


def generate_unique_routing_digits() -> str:
    for _ in range(_MAX_ALLOC_ATTEMPTS):
        digits = "".join(secrets.choice("0123456789") for _ in range(ROUTING_CODE_DIGITS))
        if not _code_in_use(digits):
            return digits
    raise RuntimeError("Could not allocate a unique vault routing code.")


def ensure_user_primary_routing_code(user: User) -> str | None:
    """Assign a random primary routing code for customers (default-jeweller inbox)."""
    if user.user_type != User.CUSTOMER:
        return None
    existing = (user.gold_routing_code or "").strip()
    if existing and len(existing) == ROUTING_CODE_DIGITS and existing.isdigit():
        return existing
    digits = generate_unique_routing_digits()
    User.objects.filter(pk=user.pk).update(gold_routing_code=digits)
    user.gold_routing_code = digits
    return digits


def ensure_vault_routing_address(vault) -> str | None:
    """Assign a random per-jeweller vault routing address if missing or legacy."""
    from .models import GoldVault

    existing = (vault.vault_public_id or "").strip()
    if existing:
        card = normalize_routing_address(existing)
        if card:
            return card
    digits = generate_unique_routing_digits()
    addr = format_routing_address(digits)
    GoldVault.objects.filter(pk=vault.pk).update(vault_public_id=addr)
    vault.vault_public_id = addr
    return addr


def ensure_vault_routing_codes_for_owner(owner: User) -> None:
    if owner.user_type != User.CUSTOMER:
        return
    ensure_user_primary_routing_code(owner)
    from .models import GoldVault

    for vault in GoldVault.objects.filter(owner=owner):
        ensure_vault_routing_address(vault)


# Backward-compatible alias (no longer derived from handle).
refresh_vault_public_ids_for_owner = ensure_vault_routing_codes_for_owner
