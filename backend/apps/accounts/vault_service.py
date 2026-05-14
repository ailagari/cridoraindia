"""Per–custodian gold vaults for customers (phase1 MVP identity layer)."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Sum

from .models import GoldBalance, GoldVault, VaultHolding

User = get_user_model()


def _fractional_holding(vault: GoldVault) -> VaultHolding:
    h, _ = VaultHolding.objects.get_or_create(
        vault=vault,
        holding_type=VaultHolding.FRACTIONAL,
        defaults={"balance_grams": Decimal("0")},
    )
    return h


def compute_vault_public_id(owner: User, custodian: User) -> str | None:
    handle = (owner.gold_handle_local or "").strip().lower()
    code = (custodian.jeweller_code or "").strip().lower()
    if not handle or not code:
        return None
    return f"{handle}.{code}@cridora"


def refresh_vault_public_ids_for_owner(owner: User) -> None:
    """Recompute vault_public_id rows after handle or jeweller code changes."""
    if owner.user_type != User.CUSTOMER:
        return
    for vault in GoldVault.objects.filter(owner=owner).select_related("custodian"):
        new_id = compute_vault_public_id(vault.owner, vault.custodian)
        nv = new_id if new_id else None
        if vault.vault_public_id != nv:
            vault.vault_public_id = nv
            vault.save(update_fields=["vault_public_id"])


def ensure_vault(owner: User, custodian: User) -> GoldVault:
    if owner.user_type != User.CUSTOMER:
        raise ValueError("Vault owner must be a customer.")
    if custodian.user_type != User.JEWELLER:
        raise ValueError("Vault custodian must be a jeweller.")
    vault, _ = GoldVault.objects.get_or_create(owner=owner, custodian=custodian)
    vid = compute_vault_public_id(owner, custodian)
    nv = vid if vid else None
    if vault.vault_public_id != nv:
        vault.vault_public_id = nv
        vault.save(update_fields=["vault_public_id"])
    _fractional_holding(vault)
    return vault


def sync_customer_aggregate_balance(customer: User) -> None:
    if customer.user_type != User.CUSTOMER:
        return
    total = (
        VaultHolding.objects.filter(
            vault__owner=customer,
            holding_type=VaultHolding.FRACTIONAL,
        ).aggregate(t=Sum("balance_grams"))["t"]
        or Decimal("0")
    )
    GoldBalance.objects.update_or_create(
        user=customer,
        defaults={"balance_grams": total},
    )


def credit_customer_fractional(customer: User, custodian: User, grams: Decimal) -> None:
    vault = ensure_vault(customer, custodian)
    VaultHolding.objects.filter(pk=_fractional_holding(vault).pk).update(
        balance_grams=F("balance_grams") + grams
    )
    sync_customer_aggregate_balance(customer)


def customer_fractional_available(customer: User, custodian: User) -> Decimal:
    try:
        vault = GoldVault.objects.get(owner=customer, custodian=custodian)
    except GoldVault.DoesNotExist:
        return Decimal("0")
    h = VaultHolding.objects.filter(
        vault=vault, holding_type=VaultHolding.FRACTIONAL
    ).first()
    return h.balance_grams if h else Decimal("0")


def debit_customer_fractional(customer: User, custodian: User, grams: Decimal) -> str | None:
    vault = ensure_vault(customer, custodian)
    hid = _fractional_holding(vault).pk
    with transaction.atomic():
        row = (
            VaultHolding.objects.select_for_update()
            .filter(pk=hid)
            .values_list("balance_grams", flat=True)
            .first()
        )
        if row is None:
            return "Vault not available."
        bal = row
        if bal < grams:
            return "Insufficient gold balance."
        VaultHolding.objects.filter(pk=hid).update(balance_grams=F("balance_grams") - grams)
    sync_customer_aggregate_balance(customer)
    return None


def legacy_credit_jeweller_balance(jeweller: User, grams: Decimal) -> None:
    GoldBalance.objects.select_for_update().get_or_create(
        user=jeweller, defaults={"balance_grams": Decimal("0")}
    )
    GoldBalance.objects.filter(user=jeweller).update(balance_grams=F("balance_grams") + grams)


def legacy_debit_jeweller_balance(jeweller: User, grams: Decimal) -> str | None:
    GoldBalance.objects.select_for_update().get_or_create(
        user=jeweller, defaults={"balance_grams": Decimal("0")}
    )
    row = GoldBalance.objects.select_for_update().get(user=jeweller)
    if row.balance_grams < grams:
        return "Insufficient gold balance."
    GoldBalance.objects.filter(pk=row.pk).update(balance_grams=F("balance_grams") - grams)
    return None


def migrate_customer_legacy_balance_if_needed(customer: User, custodian: User) -> None:
    """Move stale aggregate GoldBalance into fractional vault when vault was empty."""
    gb = getattr(customer, "gold_balance", None)
    if not gb or gb.balance_grams <= 0:
        return
    vault = ensure_vault(customer, custodian)
    hold = _fractional_holding(vault)
    if hold.balance_grams > 0:
        return
    grams = gb.balance_grams
    VaultHolding.objects.filter(pk=hold.pk).update(balance_grams=grams)
    sync_customer_aggregate_balance(customer)


def wallet_vault_payload(customer: User) -> list[dict]:
    from apps.marketplace.models import jeweller_profile_for
    from apps.marketplace.pricing import (
        jeweller_rate_effective_updated_at,
        reference_metal_rate_inr_per_gram_for_jeweller,
    )
    from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

    rows = []
    cridora_base, _ = resolve_cridora_base_22k_inr()
    qs = (
        GoldVault.objects.filter(owner=customer)
        .select_related("custodian")
        .order_by("custodian__business_name", "custodian_id")
    )
    for v in qs:
        h = VaultHolding.objects.filter(
            vault=v, holding_type=VaultHolding.FRACTIONAL
        ).first()
        g = h.balance_grams if h else Decimal("0")
        j = v.custodian
        profile = jeweller_profile_for(j)
        metal_rate = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
        est_inr = (g * metal_rate).quantize(Decimal("0.01"))
        rate_as_of = jeweller_rate_effective_updated_at(profile)
        rows.append(
            {
                "vault_public_id": v.vault_public_id or "",
                "custodian_id": j.id,
                "custodian_label": j.business_name or j.email or "",
                "fractional_grams": str(g),
                "jeweller_metal_rate_inr_per_gram": str(metal_rate),
                "estimated_fractional_value_inr": str(est_inr),
                "jeweller_metal_rate_last_updated_at": rate_as_of.isoformat(),
            }
        )
    return rows
