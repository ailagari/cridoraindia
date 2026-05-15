"""Custodial liability when customer fractional grams are credited via a jeweller."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import F

from .models import (
    FractionalGoldPurchase,
    JewellerLiabilityBalance,
    JewellerLiabilityLedgerEntry,
)

User = get_user_model()


def increment_custodial_liability_for_fractional_sale(
    jeweller: User,
    customer: User,
    grams: Decimal,
    purchase: FractionalGoldPurchase,
) -> None:
    if jeweller.user_type != User.JEWELLER:
        raise ValueError("Liability jeweller must be a jeweller user.")
    if customer.user_type != User.CUSTOMER:
        raise ValueError("Liability customer must be a customer user.")
    JewellerLiabilityLedgerEntry.objects.create(
        jeweller=jeweller,
        customer=customer,
        grams=grams,
        fractional_purchase=purchase,
    )
    bal, _ = JewellerLiabilityBalance.objects.select_for_update().get_or_create(
        jeweller=jeweller,
        defaults={"liability_grams": Decimal("0")},
    )
    JewellerLiabilityBalance.objects.filter(pk=bal.pk).update(
        liability_grams=F("liability_grams") + grams
    )


def jeweller_liability_grams(jeweller: User) -> Decimal:
    if jeweller.user_type != User.JEWELLER:
        return Decimal("0")
    row = (
        JewellerLiabilityBalance.objects.filter(jeweller=jeweller)
        .values_list("liability_grams", flat=True)
        .first()
    )
    return row if row is not None else Decimal("0")
