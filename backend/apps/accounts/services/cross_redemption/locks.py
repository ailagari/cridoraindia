"""Deterministic lock ordering: request → jewellers (min,max id) → vault holdings."""

from __future__ import annotations

from apps.accounts.models import CrossRedemptionRequest, GoldVault, JewellerCrossPolicy, VaultHolding
from apps.accounts.services.cross_redemption.authorization import _DEFAULT_POLICY


def sorted_jeweller_pair(ja_id: int, jb_id: int) -> tuple[int, int]:
    return (ja_id, jb_id) if ja_id <= jb_id else (jb_id, ja_id)


def sorted_vault_keys(owner_id: int, custodian_a: int, custodian_b: int) -> list[tuple[int, int]]:
    keys = [(owner_id, custodian_a), (owner_id, custodian_b)]
    keys.sort(key=lambda t: (t[0], t[1]))
    return keys


def acquire_request_and_policies(
    request_id: int,
    j_low: int,
    j_high: int,
    *,
    skip_locked: bool = False,
) -> tuple[CrossRedemptionRequest | None, list[JewellerCrossPolicy]]:
    """
    Lock order: CrossRedemptionRequest, then JewellerCrossPolicy min id, then max id.
    """
    qs = CrossRedemptionRequest.objects.select_for_update(skip_locked=skip_locked)
    try:
        req = qs.get(pk=request_id)
    except CrossRedemptionRequest.DoesNotExist:
        return None, []

    policy_defaults = _DEFAULT_POLICY.copy()
    p_low, _ = JewellerCrossPolicy.objects.select_for_update().get_or_create(
        jeweller_id=j_low,
        defaults=policy_defaults,
    )
    p_high, _ = JewellerCrossPolicy.objects.select_for_update().get_or_create(
        jeweller_id=j_high,
        defaults=policy_defaults,
    )
    return req, [p_low, p_high]


def lock_vault_holdings_for_customer(
    owner_id: int,
    custodian_a: int,
    custodian_b: int,
) -> None:
    """Lock all VaultHolding rows for sorted (owner, custodian) pairs."""
    for cx_id, j_id in sorted_vault_keys(owner_id, custodian_a, custodian_b):
        vault = GoldVault.objects.filter(owner_id=cx_id, custodian_id=j_id).first()
        if not vault:
            continue
        for _h in (
            VaultHolding.objects.select_for_update()
            .filter(vault_id=vault.pk)
            .order_by("pk")
        ):
            _ = _h.balance_grams
