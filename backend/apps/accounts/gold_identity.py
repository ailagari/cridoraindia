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
CRIDORA_PRIMARY_HANDLE_RE = re.compile(r"^([a-z0-9_]{3,32})@cridora$")
ROUTING_VAULT_PUBLIC = "vault_public_id"
ROUTING_PRIMARY_CRIDORA = "primary_cridora"
ROUTING_CUSTOMER_VAULT_UPI = "customer_vault_upi"
ROUTING_JEWELLER_UPI = "jeweller_upi"

MIN_TRANSFER_GRAMS = Decimal("0.000001")
MAX_TRANSFER_GRAMS = Decimal("999999.999999")


def normalize_cridora_vault_public_id(raw: str) -> str | None:
    s = (raw or "").strip().lower()
    if CRIDORA_VAULT_ID_RE.match(s):
        return s
    return None


def resolve_vault_by_public_id(raw: str):
    from .models import GoldVault

    key = normalize_cridora_vault_public_id(raw)
    if not key:
        return None
    return (
        GoldVault.objects.filter(vault_public_id__iexact=key)
        .select_related("owner", "custodian")
        .first()
    )


def resolve_owner_by_vault_public_id(raw: str) -> User | None:
    v = resolve_vault_by_public_id(raw)
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


class InboundTransferTarget:
    """Recipient user, custodian vault that receives grams, and normalized routing string."""

    __slots__ = ("recipient", "destination_custodian", "resolved_address", "routing_kind")

    def __init__(
        self,
        recipient: User,
        destination_custodian: User,
        resolved_address: str,
        routing_kind: str,
    ) -> None:
        self.recipient = recipient
        self.destination_custodian = destination_custodian
        self.resolved_address = resolved_address
        self.routing_kind = routing_kind


def resolve_inbound_transfer_target(raw: str) -> InboundTransferTarget | None:
    """
    Resolve who receives a transfer and which custodian vault is credited.

    Forms:
    - handle.jewellercode@cridora — specific customer vault at one jeweller
    - handle@cridora — primary (default jeweller) vault for that customer
    - handle@jewellercode — customer vault at that jeweller, or jeweller's own GoldUPI
    - exact stored gold_upi (legacy)
    """
    s = (raw or "").strip()
    if not s:
        return None

    v = resolve_vault_by_public_id(s)
    if v:
        return InboundTransferTarget(
            v.owner,
            v.custodian,
            v.vault_public_id or normalize_cridora_vault_public_id(s) or s.lower(),
            ROUTING_VAULT_PUBLIC,
        )

    lo = s.lower()
    m_primary = CRIDORA_PRIMARY_HANDLE_RE.match(lo)
    if m_primary:
        local = m_primary.group(1)
        cust = (
            User.objects.filter(
                gold_handle_local__iexact=local, user_type=User.CUSTOMER
            )
            .select_related("default_jeweller")
            .first()
        )
        if not cust or not cust.default_jeweller_id:
            return None
        dj = cust.default_jeweller
        if dj is None:
            return None
        return InboundTransferTarget(
            cust,
            dj,
            f"{local}@cridora",
            ROUTING_PRIMARY_CRIDORA,
        )

    normalized_upi = normalize_gold_upi(s)
    if normalized_upi:
        local, _, code = normalized_upi.partition("@")
        jeweller = (
            User.objects.filter(
                user_type=User.JEWELLER,
                jeweller_code__iexact=code,
                kyc_status=User.KYC_VERIFIED,
            )
            .first()
        )
        if not jeweller:
            return None
        j_self = (
            User.objects.filter(
                user_type=User.JEWELLER,
                gold_handle_local__iexact=local,
                jeweller_code__iexact=code,
            )
            .first()
        )
        if j_self:
            return InboundTransferTarget(
                j_self,
                j_self,
                normalized_upi,
                ROUTING_JEWELLER_UPI,
            )
        cust = (
            User.objects.filter(
                user_type=User.CUSTOMER,
                gold_handle_local__iexact=local,
            )
            .select_related("default_jeweller")
            .first()
        )
        if cust:
            return InboundTransferTarget(
                cust,
                jeweller,
                normalized_upi,
                ROUTING_CUSTOMER_VAULT_UPI,
            )
        stored = (
            User.objects.filter(gold_upi__iexact=normalized_upi)
            .select_related("default_jeweller")
            .first()
        )
        if stored:
            if stored.user_type == User.JEWELLER:
                return InboundTransferTarget(
                    stored,
                    stored,
                    normalized_upi,
                    ROUTING_JEWELLER_UPI,
                )
            dj = stored.default_jeweller
            if dj:
                return InboundTransferTarget(
                    stored,
                    dj,
                    normalized_upi,
                    ROUTING_CUSTOMER_VAULT_UPI,
                )
    return None
