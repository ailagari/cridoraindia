"""CridoraPay checkout quote — vault grams vs cash/UPI balance."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Sum

from apps.accounts.models import CridoraPayBill, VaultHolding

User = get_user_model()


def vault_grams_available(customer: User, jeweller: User) -> Decimal:
    total = (
        VaultHolding.objects.filter(
            vault__owner=customer,
            vault__custodian=jeweller,
            holding_type__in=(
                VaultHolding.FRACTIONAL,
                VaultHolding.DEPOSIT,
                VaultHolding.GOLDEN_SCHEME,
            ),
        ).aggregate(t=Sum("balance_grams"))["t"]
        or Decimal("0")
    )
    return total.quantize(Decimal("0.000001"))


def corridorapay_split(
    bill: CridoraPayBill,
    vault_grams_chosen: Decimal | None = None,
) -> dict[str, Decimal]:
    available = vault_grams_available(bill.customer, bill.jeweller)
    rate = bill.metal_rate_inr_per_gram
    total = bill.total_inr
    weight = bill.weight_grams
    max_grams = min(available, weight)
    if rate > 0:
        max_by_inr = (total / rate).quantize(Decimal("0.000001"))
        max_grams = min(max_grams, max_by_inr)

    if vault_grams_chosen is None:
        chosen = max_grams
    else:
        chosen = min(vault_grams_chosen.quantize(Decimal("0.000001")), max_grams)
        if chosen < 0:
            chosen = Decimal("0")

    vault_inr = (chosen * rate).quantize(Decimal("0.01")) if rate > 0 else Decimal("0")
    if vault_inr > total:
        vault_inr = total.quantize(Decimal("0.01"))
    cash = (total - vault_inr).quantize(Decimal("0.01"))
    return {
        "vault_grams_available": available,
        "vault_grams_max": max_grams,
        "vault_grams_chosen": chosen,
        "vault_inr_applied": vault_inr,
        "cash_payable_inr": cash,
    }


def corridorapay_quote_payload(
    bill: CridoraPayBill,
    vault_grams_chosen: Decimal | None = None,
) -> dict:
    split = corridorapay_split(bill, vault_grams_chosen)
    j = bill.jeweller
    return {
        "bill_id": bill.id,
        "reference": bill.reference,
        "title": bill.title,
        "weight_grams": str(bill.weight_grams),
        "total_inr": str(bill.total_inr),
        "metal_rate_inr_per_gram": str(bill.metal_rate_inr_per_gram),
        "status": bill.status,
        "payment_method": bill.payment_method or "",
        "vault_grams_available": str(split["vault_grams_available"]),
        "vault_grams_max": str(split["vault_grams_max"]),
        "vault_grams_chosen": str(split["vault_grams_chosen"]),
        "vault_inr_applied": str(split["vault_inr_applied"]),
        "cash_payable_inr": str(split["cash_payable_inr"]),
        "vault_covers_full_bill": split["cash_payable_inr"] <= 0 and split["vault_grams_chosen"] > 0,
        "jeweller_id": j.id,
        "jeweller_name": j.business_name or j.email or "",
    }
