"""Custodial liability when customer fractional grams are credited via a jeweller."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import F

from .models import (
    CrossRedemptionRequest,
    FractionalGoldPurchase,
    GoldDepositIntake,
    GoldSellbackRequest,
    JewellerLiabilityBalance,
    JewellerLiabilityLedgerEntry,
    VaultProductRedemption,
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
        kind=JewellerLiabilityLedgerEntry.LEDGER_KIND_FRACTIONAL_CREDIT,
        fractional_purchase=purchase,
        gold_sellback=None,
    )
    bal, _ = JewellerLiabilityBalance.objects.select_for_update().get_or_create(
        jeweller=jeweller,
        defaults={"liability_grams": Decimal("0")},
    )
    JewellerLiabilityBalance.objects.filter(pk=bal.pk).update(
        liability_grams=F("liability_grams") + grams
    )


def increment_custodial_liability_for_gold_deposit(
    jeweller: User,
    customer: User,
    grams: Decimal,
    intake: GoldDepositIntake,
) -> None:
    if jeweller.user_type != User.JEWELLER:
        raise ValueError("Liability jeweller must be a jeweller user.")
    if customer.user_type != User.CUSTOMER:
        raise ValueError("Liability customer must be a customer user.")
    JewellerLiabilityLedgerEntry.objects.create(
        jeweller=jeweller,
        customer=customer,
        grams=grams,
        kind=JewellerLiabilityLedgerEntry.LEDGER_KIND_DEPOSIT_CREDIT,
        fractional_purchase=None,
        gold_sellback=None,
        gold_deposit_intake=intake,
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


def release_custodial_liability_for_sellback(
    jeweller: User,
    customer: User,
    grams: Decimal,
    sellback: GoldSellbackRequest,
) -> None:
    if jeweller.user_type != User.JEWELLER:
        raise ValueError("Liability jeweller must be a jeweller user.")
    if customer.user_type != User.CUSTOMER:
        raise ValueError("Customer required.")
    JewellerLiabilityLedgerEntry.objects.create(
        jeweller=jeweller,
        customer=customer,
        grams=grams,
        kind=JewellerLiabilityLedgerEntry.LEDGER_KIND_SELLBACK_RELEASE,
        fractional_purchase=None,
        gold_sellback=sellback,
    )
    bal, _ = JewellerLiabilityBalance.objects.select_for_update().get_or_create(
        jeweller=jeweller,
        defaults={"liability_grams": Decimal("0")},
    )
    bal.refresh_from_db()
    new_liab = bal.liability_grams - grams
    if new_liab < Decimal("0"):
        new_liab = Decimal("0")
    JewellerLiabilityBalance.objects.filter(pk=bal.pk).update(liability_grams=new_liab)


def release_custodial_liability_for_redemption_purchase(
    jeweller: User,
    customer: User,
    grams: Decimal,
    redemption: VaultProductRedemption,
) -> None:
    if jeweller.user_type != User.JEWELLER:
        raise ValueError("Liability jeweller must be a jeweller user.")
    if customer.user_type != User.CUSTOMER:
        raise ValueError("Customer required.")
    JewellerLiabilityLedgerEntry.objects.create(
        jeweller=jeweller,
        customer=customer,
        grams=grams,
        kind=JewellerLiabilityLedgerEntry.LEDGER_KIND_REDEMPTION_PURCHASE_RELEASE,
        fractional_purchase=None,
        gold_sellback=None,
        vault_product_redemption=redemption,
    )
    bal, _ = JewellerLiabilityBalance.objects.select_for_update().get_or_create(
        jeweller=jeweller,
        defaults={"liability_grams": Decimal("0")},
    )
    bal.refresh_from_db()
    new_liab = bal.liability_grams - grams
    if new_liab < Decimal("0"):
        new_liab = Decimal("0")
    JewellerLiabilityBalance.objects.filter(pk=bal.pk).update(liability_grams=new_liab)


def release_custodial_liability_for_corridorapay(
    jeweller: User,
    customer: User,
    grams: Decimal,
    bill,
) -> None:
    if jeweller.user_type != User.JEWELLER:
        raise ValueError("Liability jeweller must be a jeweller user.")
    if customer.user_type != User.CUSTOMER:
        raise ValueError("Customer required.")
    JewellerLiabilityLedgerEntry.objects.create(
        jeweller=jeweller,
        customer=customer,
        grams=grams,
        kind=JewellerLiabilityLedgerEntry.LEDGER_KIND_CORRIDORAPAY_RELEASE,
        fractional_purchase=None,
        gold_sellback=None,
        corridorapay_bill=bill,
    )
    bal, _ = JewellerLiabilityBalance.objects.select_for_update().get_or_create(
        jeweller=jeweller,
        defaults={"liability_grams": Decimal("0")},
    )
    bal.refresh_from_db()
    new_liab = bal.liability_grams - grams
    if new_liab < Decimal("0"):
        new_liab = Decimal("0")
    JewellerLiabilityBalance.objects.filter(pk=bal.pk).update(liability_grams=new_liab)


def release_custodial_liability_cross_redemption_source(
    jeweller: User,
    customer: User,
    grams: Decimal,
    redemption: CrossRedemptionRequest,
) -> None:
    if jeweller.user_type != User.JEWELLER:
        raise ValueError("Liability jeweller must be a jeweller user.")
    if customer.user_type != User.CUSTOMER:
        raise ValueError("Customer required.")
    JewellerLiabilityLedgerEntry.objects.create(
        jeweller=jeweller,
        customer=customer,
        grams=grams,
        kind=JewellerLiabilityLedgerEntry.LEDGER_KIND_CROSS_REDEMPTION_SOURCE_RELEASE,
        fractional_purchase=None,
        gold_sellback=None,
        cross_redemption_request=redemption,
    )
    bal, _ = JewellerLiabilityBalance.objects.select_for_update().get_or_create(
        jeweller=jeweller,
        defaults={"liability_grams": Decimal("0")},
    )
    bal.refresh_from_db()
    new_liab = bal.liability_grams - grams
    if new_liab < Decimal("0"):
        new_liab = Decimal("0")
    JewellerLiabilityBalance.objects.filter(pk=bal.pk).update(liability_grams=new_liab)


def assume_custodial_liability_cross_redemption_destination(
    jeweller: User,
    customer: User,
    grams: Decimal,
    redemption: CrossRedemptionRequest,
) -> None:
    if jeweller.user_type != User.JEWELLER:
        raise ValueError("Liability jeweller must be a jeweller user.")
    if customer.user_type != User.CUSTOMER:
        raise ValueError("Liability customer must be a customer user.")
    JewellerLiabilityLedgerEntry.objects.create(
        jeweller=jeweller,
        customer=customer,
        grams=grams,
        kind=JewellerLiabilityLedgerEntry.LEDGER_KIND_CROSS_REDEMPTION_DEST_ASSUME,
        fractional_purchase=None,
        gold_sellback=None,
        cross_redemption_request=redemption,
    )
    bal, _ = JewellerLiabilityBalance.objects.select_for_update().get_or_create(
        jeweller=jeweller,
        defaults={"liability_grams": Decimal("0")},
    )
    JewellerLiabilityBalance.objects.filter(pk=bal.pk).update(
        liability_grams=F("liability_grams") + grams
    )


def rollback_release_custodial_liability_cross_redemption_source(
    jeweller: User,
    customer: User,
    grams: Decimal,
    redemption: CrossRedemptionRequest,
) -> None:
    """Reverse source release: restore custodial liability at source jeweller."""
    if jeweller.user_type != User.JEWELLER:
        raise ValueError("Liability jeweller must be a jeweller user.")
    if customer.user_type != User.CUSTOMER:
        raise ValueError("Customer required.")
    JewellerLiabilityLedgerEntry.objects.create(
        jeweller=jeweller,
        customer=customer,
        grams=grams,
        kind=JewellerLiabilityLedgerEntry.LEDGER_KIND_CROSS_REDEMPTION_SOURCE_ROLLBACK,
        fractional_purchase=None,
        gold_sellback=None,
        cross_redemption_request=redemption,
    )
    bal, _ = JewellerLiabilityBalance.objects.select_for_update().get_or_create(
        jeweller=jeweller,
        defaults={"liability_grams": Decimal("0")},
    )
    JewellerLiabilityBalance.objects.filter(pk=bal.pk).update(
        liability_grams=F("liability_grams") + grams
    )


def rollback_assume_custodial_liability_cross_redemption_destination(
    jeweller: User,
    customer: User,
    grams: Decimal,
    redemption: CrossRedemptionRequest,
) -> None:
    """Reverse destination assume: remove liability assumed at destination jeweller."""
    if jeweller.user_type != User.JEWELLER:
        raise ValueError("Liability jeweller must be a jeweller user.")
    if customer.user_type != User.CUSTOMER:
        raise ValueError("Liability customer must be a customer user.")
    JewellerLiabilityLedgerEntry.objects.create(
        jeweller=jeweller,
        customer=customer,
        grams=grams,
        kind=JewellerLiabilityLedgerEntry.LEDGER_KIND_CROSS_REDEMPTION_DEST_ROLLBACK,
        fractional_purchase=None,
        gold_sellback=None,
        cross_redemption_request=redemption,
    )
    bal, _ = JewellerLiabilityBalance.objects.select_for_update().get_or_create(
        jeweller=jeweller,
        defaults={"liability_grams": Decimal("0")},
    )
    bal.refresh_from_db()
    new_liab = bal.liability_grams - grams
    if new_liab < Decimal("0"):
        new_liab = Decimal("0")
    JewellerLiabilityBalance.objects.filter(pk=bal.pk).update(liability_grams=new_liab)
