"""Jeweller INR revenue ledger (fractional sales, loan fees, ornament checkout)."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import F, Sum

from .models import (
    FractionalGoldPurchase,
    GoldDepositIntake,
    GoldLoanRequest,
    JewellerRevenueBalance,
    JewellerRevenueLedgerEntry,
    VaultProductRedemption,
)

User = get_user_model()


def _customer_label(customer: User | None) -> str:
    if not customer:
        return ""
    name = f"{customer.first_name} {customer.last_name}".strip()
    return name or (customer.email or "")


def record_jeweller_revenue(
    jeweller: User,
    amount_inr: Decimal,
    kind: str,
    *,
    customer: User | None = None,
    reference_label: str = "",
    fractional_purchase: FractionalGoldPurchase | None = None,
    gold_loan: GoldLoanRequest | None = None,
    vault_product_redemption: VaultProductRedemption | None = None,
    gold_deposit_intake: GoldDepositIntake | None = None,
    skip_if_duplicate_loan_fee: bool = False,
) -> JewellerRevenueLedgerEntry | None:
    if jeweller.user_type != User.JEWELLER:
        raise ValueError("Revenue jeweller must be a jeweller user.")
    if amount_inr <= 0:
        return None
    if (
        skip_if_duplicate_loan_fee
        and gold_loan is not None
        and kind == JewellerRevenueLedgerEntry.KIND_LOAN_PROCESSING_FEE
    ):
        if JewellerRevenueLedgerEntry.objects.filter(
            gold_loan_id=gold_loan.pk,
            kind=kind,
        ).exists():
            return None
    row = JewellerRevenueLedgerEntry.objects.create(
        jeweller=jeweller,
        customer=customer,
        amount_inr=amount_inr.quantize(Decimal("0.01")),
        kind=kind,
        reference_label=reference_label[:64],
        fractional_purchase=fractional_purchase,
        gold_loan=gold_loan,
        vault_product_redemption=vault_product_redemption,
        gold_deposit_intake=gold_deposit_intake,
    )
    bal, _ = JewellerRevenueBalance.objects.select_for_update().get_or_create(
        jeweller=jeweller,
        defaults={"total_revenue_inr": Decimal("0")},
    )
    JewellerRevenueBalance.objects.filter(pk=bal.pk).update(
        total_revenue_inr=F("total_revenue_inr") + amount_inr.quantize(Decimal("0.01"))
    )
    return row


def jeweller_total_revenue_inr(jeweller: User) -> Decimal:
    if jeweller.user_type != User.JEWELLER:
        return Decimal("0")
    row = (
        JewellerRevenueBalance.objects.filter(jeweller=jeweller)
        .values_list("total_revenue_inr", flat=True)
        .first()
    )
    return row if row is not None else Decimal("0")


def jeweller_revenue_by_kind(jeweller: User) -> dict[str, str]:
    if jeweller.user_type != User.JEWELLER:
        return {}
    rows = (
        JewellerRevenueLedgerEntry.objects.filter(jeweller=jeweller)
        .values("kind")
        .annotate(t=Sum("amount_inr"))
    )
    out: dict[str, str] = {}
    for r in rows:
        out[str(r["kind"])] = str((r["t"] or Decimal("0")).quantize(Decimal("0.01")))
    return out


def jeweller_recent_revenue_entries(jeweller: User, *, limit: int = 40) -> list[dict]:
    if jeweller.user_type != User.JEWELLER:
        return []
    qs = (
        JewellerRevenueLedgerEntry.objects.filter(jeweller=jeweller)
        .select_related("customer")
        .order_by("-created_at")[:limit]
    )
    rows: list[dict] = []
    for e in qs:
        rows.append(
            {
                "amount_inr": str(e.amount_inr),
                "kind": e.kind,
                "reference_label": e.reference_label,
                "customer_label": _customer_label(e.customer),
                "created_at": e.created_at.isoformat(),
            }
        )
    return rows


def record_fractional_sale_revenue(purchase: FractionalGoldPurchase) -> None:
    record_jeweller_revenue(
        purchase.jeweller,
        purchase.total_inr,
        JewellerRevenueLedgerEntry.KIND_FRACTIONAL_SALE,
        customer=purchase.customer,
        reference_label=f"FR-{purchase.id}",
        fractional_purchase=purchase,
    )


def record_loan_processing_fee_revenue(loan: GoldLoanRequest) -> None:
    record_jeweller_revenue(
        loan.jeweller,
        loan.processing_fee_jeweller_share_inr_snapshot,
        JewellerRevenueLedgerEntry.KIND_LOAN_PROCESSING_FEE,
        customer=loan.customer,
        reference_label=f"LN-{loan.id}",
        gold_loan=loan,
        skip_if_duplicate_loan_fee=True,
    )


def record_ornament_sale_revenue(
    redemption: VaultProductRedemption,
    *,
    amount_inr: Decimal | None = None,
) -> None:
    amt = amount_inr if amount_inr is not None else redemption.jeweller_subtotal_inr
    if amt <= 0:
        amt = redemption.final_invoice_inr
    record_jeweller_revenue(
        redemption.jeweller,
        amt,
        JewellerRevenueLedgerEntry.KIND_ORNAMENT_SALE,
        customer=redemption.customer,
        reference_label=f"RP-{redemption.id}",
        vault_product_redemption=redemption,
    )
