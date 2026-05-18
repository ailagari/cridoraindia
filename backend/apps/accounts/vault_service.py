"""Per–custodian gold vaults for customers (phase1 MVP identity layer)."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Sum

from .models import GoldBalance, GoldVault, VaultHolding

User = get_user_model()

VAULT_TRANSFER_DEBIT_ORDER = (
    VaultHolding.FRACTIONAL,
    VaultHolding.DEPOSIT,
    VaultHolding.GOLDEN_SCHEME,
)


def _vault_holding(vault: GoldVault, holding_type: str) -> VaultHolding:
    h, _ = VaultHolding.objects.get_or_create(
        vault=vault,
        holding_type=holding_type,
        defaults={"balance_grams": Decimal("0")},
    )
    return h


def _fractional_holding(vault: GoldVault) -> VaultHolding:
    return _vault_holding(vault, VaultHolding.FRACTIONAL)


def _deposit_holding(vault: GoldVault) -> VaultHolding:
    return _vault_holding(vault, VaultHolding.DEPOSIT)

from .vault_routing_codes import (
    ensure_user_primary_routing_code,
    ensure_vault_routing_address,
    ensure_vault_routing_codes_for_owner,
    format_routing_address,
    refresh_vault_public_ids_for_owner,
)


def ensure_vault(owner: User, custodian: User) -> GoldVault:
    if owner.user_type != User.CUSTOMER:
        raise ValueError("Vault owner must be a customer.")
    if custodian.user_type != User.JEWELLER:
        raise ValueError("Vault custodian must be a jeweller.")
    vault, _ = GoldVault.objects.get_or_create(owner=owner, custodian=custodian)
    ensure_vault_routing_address(vault)
    ensure_user_primary_routing_code(owner)
    _fractional_holding(vault)
    sync_default_jeweller_if_single_vault(owner)
    return vault


def sync_default_jeweller_if_single_vault(customer: User) -> bool:
    """When a customer has exactly one vault custodian, that jeweller becomes primary."""
    if customer.user_type != User.CUSTOMER:
        return False
    custodian_ids = list(
        GoldVault.objects.filter(owner=customer)
        .values_list("custodian_id", flat=True)
        .distinct()
    )
    if len(custodian_ids) != 1:
        return False
    only_id = custodian_ids[0]
    if customer.default_jeweller_id == only_id:
        return False
    jeweller = User.objects.filter(
        pk=only_id,
        user_type=User.JEWELLER,
        kyc_status=User.KYC_VERIFIED,
    ).first()
    if not jeweller:
        return False
    from .gold_identity import compute_gold_upi

    User.objects.filter(pk=customer.pk).update(default_jeweller_id=only_id)
    customer.default_jeweller_id = only_id
    customer.default_jeweller = jeweller
    upi = compute_gold_upi(customer)
    upi_str = upi if upi else None
    User.objects.filter(pk=customer.pk).update(gold_upi=upi_str)
    customer.gold_upi = upi_str
    migrate_customer_legacy_balance_if_needed(customer, jeweller)
    return True


def customer_has_vault_at_custodian(customer: User, custodian: User) -> bool:
    if customer.user_type != User.CUSTOMER:
        return False
    if custodian.user_type != User.JEWELLER:
        return False
    return GoldVault.objects.filter(owner=customer, custodian=custodian).exists()


def sync_customer_aggregate_balance(customer: User) -> None:
    if customer.user_type != User.CUSTOMER:
        return
    total = (
        VaultHolding.objects.filter(vault__owner=customer).aggregate(
            t=Sum("balance_grams")
        )["t"]
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


def credit_customer_deposit(customer: User, custodian: User, grams: Decimal) -> None:
    vault = ensure_vault(customer, custodian)
    VaultHolding.objects.filter(pk=_deposit_holding(vault).pk).update(
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


def debit_customer_vault_for_transfer(
    customer: User, custodian: User, grams: Decimal
) -> tuple[list[tuple[str, Decimal]], str | None]:
    """
    Debit vault grams in order: fractional, deposit, golden_scheme.
    Returns (list of (holding_type, grams) debited, error message or None).
    """
    vault = ensure_vault(customer, custodian)
    holdings = {ht: _vault_holding(vault, ht) for ht in VAULT_TRANSFER_DEBIT_ORDER}
    lines: list[tuple[str, Decimal]] = []
    with transaction.atomic():
        locked_bal: dict[str, Decimal] = {}
        total_avail = Decimal("0")
        for ht in VAULT_TRANSFER_DEBIT_ORDER:
            pk = holdings[ht].pk
            b = (
                VaultHolding.objects.select_for_update()
                .filter(pk=pk)
                .values_list("balance_grams", flat=True)
                .first()
            )
            bal = b if b is not None else Decimal("0")
            locked_bal[ht] = bal
            total_avail += bal
        if total_avail < grams:
            return [], "Insufficient gold balance."
        remaining = grams
        for ht in VAULT_TRANSFER_DEBIT_ORDER:
            if remaining <= 0:
                break
            take = min(locked_bal[ht], remaining)
            if take > 0:
                VaultHolding.objects.filter(pk=holdings[ht].pk).update(
                    balance_grams=F("balance_grams") - take
                )
                lines.append((ht, take))
                remaining -= take
    sync_customer_aggregate_balance(customer)
    return lines, None


def credit_customer_vault_lines(
    customer: User, custodian: User, lines: list[tuple[str, Decimal]]
) -> None:
    vault = ensure_vault(customer, custodian)
    for holding_type, g in lines:
        if g <= 0:
            continue
        hid = _vault_holding(vault, holding_type).pk
        VaultHolding.objects.filter(pk=hid).update(balance_grams=F("balance_grams") + g)
    sync_customer_aggregate_balance(customer)


def debit_customer_vault_lines(
    customer: User, custodian: User, lines: list[tuple[str, Decimal]]
) -> str | None:
    """Subtract grams by holding_type rows; returns error or None."""
    vault = ensure_vault(customer, custodian)
    with transaction.atomic():
        for holding_type, g in lines:
            if g <= 0:
                continue
            hid = _vault_holding(vault, holding_type).pk
            b = (
                VaultHolding.objects.select_for_update()
                .filter(pk=hid)
                .values_list("balance_grams", flat=True)
                .first()
            )
            bal = b if b is not None else Decimal("0")
            if bal < g:
                return "Insufficient gold balance."
            VaultHolding.objects.filter(pk=hid).update(balance_grams=F("balance_grams") - g)
    sync_customer_aggregate_balance(customer)
    return None


def reverse_customer_vault_transfer_lines(
    customer: User,
    source_custodian: User,
    destination_custodian: User,
    lines: list[tuple[str, Decimal]],
) -> str | None:
    """
    Undo a prior debit-from-source / credit-to-destination transfer using the same line breakdown.
    """
    err = debit_customer_vault_lines(customer, destination_custodian, lines)
    if err:
        return err
    credit_customer_vault_lines(customer, source_custodian, lines)
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
    from django.db.models import Prefetch

    from apps.marketplace.models import jeweller_profile_for
    from apps.marketplace.pricing import (
        jeweller_rate_effective_updated_at,
        reference_metal_rate_inr_per_gram_for_jeweller,
    )
    from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

    rows = []
    cridora_base, _ = resolve_cridora_base_22k_inr()
    holdings_prefetch = Prefetch(
        "holdings",
        queryset=VaultHolding.objects.filter(
            holding_type__in=(
                VaultHolding.FRACTIONAL,
                VaultHolding.DEPOSIT,
                VaultHolding.GOLDEN_SCHEME,
            )
        ),
    )
    qs = (
        GoldVault.objects.filter(owner=customer)
        .select_related("custodian")
        .prefetch_related(holdings_prefetch)
        .order_by("custodian__business_name", "custodian_id")
    )
    for v in qs:
        by_type: dict[str, Decimal] = {}
        for h in v.holdings.all():
            by_type[h.holding_type] = h.balance_grams
        g_frac = by_type.get(VaultHolding.FRACTIONAL, Decimal("0"))
        g_dep = by_type.get(VaultHolding.DEPOSIT, Decimal("0"))
        g_scheme = by_type.get(VaultHolding.GOLDEN_SCHEME, Decimal("0"))
        total_g = g_frac + g_dep + g_scheme
        j = v.custodian
        profile = jeweller_profile_for(j)
        metal_rate = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
        est_frac = (g_frac * metal_rate).quantize(Decimal("0.01"))
        est_dep = (g_dep * metal_rate).quantize(Decimal("0.01"))
        est_scheme = (g_scheme * metal_rate).quantize(Decimal("0.01"))
        est_vault = (total_g * metal_rate).quantize(Decimal("0.01"))
        rate_as_of = jeweller_rate_effective_updated_at(profile)
        rows.append(
            {
                "vault_public_id": v.vault_public_id or "",
                "custodian_id": j.id,
                "custodian_label": j.business_name or j.email or "",
                "is_primary_custodian": bool(
                    customer.default_jeweller_id
                    and j.id == customer.default_jeweller_id
                ),
                "fractional_grams": str(g_frac),
                "deposit_grams": str(g_dep),
                "golden_scheme_grams": str(g_scheme),
                "vault_total_grams": str(total_g),
                "jeweller_metal_rate_inr_per_gram": str(metal_rate),
                "estimated_fractional_value_inr": str(est_frac),
                "estimated_deposit_value_inr": str(est_dep),
                "estimated_golden_scheme_value_inr": str(est_scheme),
                "estimated_vault_value_inr": str(est_vault),
                "jeweller_metal_rate_last_updated_at": rate_as_of.isoformat(),
            }
        )
    return rows


def jeweller_custody_vault_payload(jeweller: User) -> list[dict]:
    """Customer vaults custodied by this jeweller (any non-zero vault balance), with reference ₹/g marks."""
    if jeweller.user_type != User.JEWELLER:
        return []
    from django.db.models import Prefetch

    from apps.marketplace.models import jeweller_profile_for
    from apps.marketplace.pricing import (
        jeweller_rate_effective_updated_at,
        reference_metal_rate_inr_per_gram_for_jeweller,
    )
    from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

    profile = jeweller_profile_for(jeweller)
    cridora_base, _ = resolve_cridora_base_22k_inr()
    metal_rate = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
    rate_as_of = jeweller_rate_effective_updated_at(profile)
    rate_iso = rate_as_of.isoformat()

    holdings_prefetch = Prefetch(
        "holdings",
        queryset=VaultHolding.objects.filter(
            holding_type__in=(
                VaultHolding.FRACTIONAL,
                VaultHolding.DEPOSIT,
                VaultHolding.GOLDEN_SCHEME,
            )
        ),
    )
    qs = (
        GoldVault.objects.filter(custodian=jeweller)
        .select_related("owner")
        .prefetch_related(holdings_prefetch)
        .order_by("owner_id")
    )
    rows: list[dict] = []
    for v in qs:
        by_type: dict[str, Decimal] = {}
        for h in v.holdings.all():
            by_type[h.holding_type] = h.balance_grams
        g_frac = by_type.get(VaultHolding.FRACTIONAL, Decimal("0"))
        g_dep = by_type.get(VaultHolding.DEPOSIT, Decimal("0"))
        g_scheme = by_type.get(VaultHolding.GOLDEN_SCHEME, Decimal("0"))
        total_g = g_frac + g_dep + g_scheme
        if total_g <= 0:
            continue
        owner = v.owner
        est_frac = (g_frac * metal_rate).quantize(Decimal("0.01"))
        est_total = (total_g * metal_rate).quantize(Decimal("0.01"))
        label = f"{owner.first_name} {owner.last_name}".strip() or "Customer"
        rows.append(
            {
                "customer_id": owner.id,
                "customer_member_id": owner.cridora_member_id or "",
                "customer_label": label,
                "fractional_grams": str(g_frac),
                "deposit_grams": str(g_dep),
                "golden_scheme_grams": str(g_scheme),
                "vault_total_grams": str(total_g),
                "jeweller_metal_rate_inr_per_gram": str(metal_rate),
                "estimated_fractional_value_inr": str(est_frac),
                "estimated_total_vault_value_inr": str(est_total),
                "jeweller_metal_rate_last_updated_at": rate_iso,
            }
        )
    rows.sort(key=lambda r: Decimal(r["vault_total_grams"]), reverse=True)
    return rows
