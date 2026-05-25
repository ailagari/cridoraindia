"""Jeweller↔platform settlement net balance and payment initiation."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import Sum

from apps.accounts.models import (
    PlatformCommercialLedgerEntry,
    PlatformSettlementBatch,
    PlatformSettlementOtp,
    PlatformSettlementPayment,
    JewellerRevenueLedgerEntry,
)
from apps.accounts.services.platform_treasury_ledger import FEATURE_LABELS, _customer_label
from apps.accounts.services.settlement_payment_service import serialize_settlement_payment

User = get_user_model()

ACTIVE_STATUSES = (
    PlatformSettlementPayment.STATUS_PENDING_PROOF,
    PlatformSettlementPayment.STATUS_SUBMITTED,
)


def _quantize_inr(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _parse_amount(raw: Any) -> Decimal | None:
    if raw is None:
        return None
    try:
        value = Decimal(str(raw).strip())
    except (InvalidOperation, ValueError):
        return None
    if value <= 0:
        return None
    return _quantize_inr(value)


def _fees_accrued_for_jeweller(jeweller: User) -> Decimal:
    pending = (
        PlatformCommercialLedgerEntry.objects.filter(
            jeweller=jeweller,
            status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
        ).aggregate(s=Sum("amount_inr"))
        .get("s")
        or Decimal("0")
    )
    open_positive = (
        PlatformSettlementBatch.objects.filter(
            jeweller=jeweller,
            settled_at__isnull=True,
            net_payable_inr__gt=0,
        ).aggregate(s=Sum("net_payable_inr"))
        .get("s")
        or Decimal("0")
    )
    return pending + open_positive


def _platform_credit_for_jeweller(jeweller: User) -> Decimal:
    open_negative = (
        PlatformSettlementBatch.objects.filter(
            jeweller=jeweller,
            settled_at__isnull=True,
            net_payable_inr__lt=0,
        ).aggregate(s=Sum("net_payable_inr"))
        .get("s")
        or Decimal("0")
    )
    return abs(open_negative)


def _in_flight_for_jeweller(jeweller: User, direction: str) -> Decimal:
    total = (
        PlatformSettlementPayment.objects.filter(
            jeweller=jeweller,
            direction=direction,
            status__in=ACTIVE_STATUSES,
        ).aggregate(s=Sum("amount_inr"))
        .get("s")
        or Decimal("0")
    )
    return total


def _active_payment_for_jeweller(jeweller: User) -> PlatformSettlementPayment | None:
    return (
        PlatformSettlementPayment.objects.filter(
            jeweller=jeweller,
            status__in=ACTIVE_STATUSES,
        )
        .select_related("jeweller")
        .order_by("-created_at")
        .first()
    )


def jeweller_net_balance(jeweller: User) -> dict[str, Any]:
    fees = _fees_accrued_for_jeweller(jeweller)
    credit = _platform_credit_for_jeweller(jeweller)
    in_flight_j2p = _in_flight_for_jeweller(jeweller, PlatformSettlementPayment.DIR_JEWELLER_TO_PLATFORM)
    in_flight_p2j = _in_flight_for_jeweller(jeweller, PlatformSettlementPayment.DIR_PLATFORM_TO_JEWELLER)
    in_flight = in_flight_j2p + in_flight_p2j

    net_payable = max(Decimal("0"), fees - credit - in_flight_j2p)
    net_credit = max(Decimal("0"), credit - fees - in_flight_p2j)

    if net_payable > 0:
        direction = "pay"
    elif net_credit > 0:
        direction = "receive"
    else:
        direction = "clear"

    active = _active_payment_for_jeweller(jeweller)
    active_payload = None
    if active:
        otp_expires_at = None
        otp_verified = False
        try:
            otp_row = active.settlement_otp
            otp_expires_at = otp_row.expires_at.isoformat() if otp_row.expires_at else None
            otp_verified = bool(otp_row.verified_at)
        except PlatformSettlementOtp.DoesNotExist:
            pass
        active_payload = {
            "id": active.pk,
            "direction": active.direction,
            "status": active.status,
            "amount_inr": str(active.amount_inr),
            "payment_method": active.payment_method,
            "otp_expires_at": otp_expires_at,
            "otp_verified": otp_verified,
        }

    return {
        "fees_accrued_inr": str(_quantize_inr(fees)),
        "platform_credit_inr": str(_quantize_inr(credit)),
        "in_flight_inr": str(_quantize_inr(in_flight)),
        "net_payable_inr": str(_quantize_inr(net_payable)),
        "net_credit_inr": str(_quantize_inr(net_credit)),
        "direction": direction,
        "pending_platform_fee_inr": str(_quantize_inr(net_payable)),
        "active_payment": active_payload,
        "period": "open",
    }


def jeweller_settlement_summary_payload(jeweller: User) -> dict[str, Any]:
    return jeweller_net_balance(jeweller)


def _revenue_inr_for_fractional(purchase_id: int, jeweller_id: int) -> Decimal:
    total = (
        JewellerRevenueLedgerEntry.objects.filter(
            fractional_purchase_id=purchase_id,
            jeweller_id=jeweller_id,
        ).aggregate(s=Sum("amount_inr"))
        .get("s")
        or Decimal("0")
    )
    return _quantize_inr(total)


def _revenue_inr_for_redemption(redemption_id: int, jeweller_id: int) -> Decimal:
    total = (
        JewellerRevenueLedgerEntry.objects.filter(
            vault_product_redemption_id=redemption_id,
            jeweller_id=jeweller_id,
        ).aggregate(s=Sum("amount_inr"))
        .get("s")
        or Decimal("0")
    )
    return _quantize_inr(total)


def _serialize_pending_commercial_entry(entry: PlatformCommercialLedgerEntry) -> dict[str, Any] | None:
    purchase = entry.fractional_purchase
    redemption = entry.vault_product_redemption
    if purchase:
        feature = "fractional"
        reference = f"FR-{purchase.pk}"
        when = (purchase.jeweller_verified_at or purchase.created_at).isoformat()
        customer = purchase.customer
        transaction_inr = _quantize_inr(purchase.total_inr)
        jeweller_revenue = _revenue_inr_for_fractional(purchase.pk, entry.jeweller_id)
    elif redemption:
        feature = "ornament_redemption"
        reference = f"RP-{redemption.pk}"
        when = redemption.created_at.isoformat()
        customer = redemption.customer
        transaction_inr = _quantize_inr(redemption.final_invoice_inr)
        jeweller_revenue = _revenue_inr_for_redemption(redemption.pk, entry.jeweller_id)
    else:
        return None

    fee_label = "Spread fee" if entry.kind == PlatformCommercialLedgerEntry.KIND_SPREAD_FEE else "Cross-platform fee"
    return {
        "when": when,
        "feature": feature,
        "feature_label": FEATURE_LABELS.get(feature, feature),
        "fee_kind": entry.kind,
        "fee_kind_label": fee_label,
        "reference": reference,
        "customer": _customer_label(customer),
        "transaction_amount_inr": str(transaction_inr),
        "platform_fee_inr": str(_quantize_inr(entry.amount_inr)),
        "jeweller_revenue_inr": str(jeweller_revenue),
        "settlement_status": entry.status,
    }


def jeweller_settlement_ledger_payload(jeweller: User) -> dict[str, Any]:
    entries = (
        PlatformCommercialLedgerEntry.objects.filter(
            jeweller=jeweller,
            status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
        )
        .select_related(
            "fractional_purchase",
            "fractional_purchase__customer",
            "vault_product_redemption",
            "vault_product_redemption__customer",
        )
        .order_by("-created_at")
    )

    rows: list[dict[str, Any]] = []
    total_fee = Decimal("0")
    total_revenue = Decimal("0")
    total_txn = Decimal("0")
    for entry in entries:
        row = _serialize_pending_commercial_entry(entry)
        if not row:
            continue
        rows.append(row)
        total_fee += Decimal(row["platform_fee_inr"])
        total_revenue += Decimal(row["jeweller_revenue_inr"])
        total_txn += Decimal(row["transaction_amount_inr"])

    all_rows = rows
    all_rows.sort(key=lambda r: r["when"], reverse=True)

    return {
        "results": all_rows,
        "count": len(all_rows),
        "totals": {
            "platform_fee_inr": str(_quantize_inr(total_fee)),
            "jeweller_revenue_inr": str(_quantize_inr(total_revenue)),
            "transaction_amount_inr": str(_quantize_inr(total_txn)),
        },
    }


def _validate_payment_method(raw: Any) -> str | None:
    method = str(raw or PlatformSettlementPayment.PAY_UPI).strip().lower()
    if method not in (PlatformSettlementPayment.PAY_UPI, PlatformSettlementPayment.PAY_OTP):
        return None
    return method


def initiate_jeweller_payment(
    jeweller: User,
    *,
    amount_inr: Any = None,
    payment_method: Any = PlatformSettlementPayment.PAY_UPI,
) -> tuple[PlatformSettlementPayment | None, str | None]:
    method = _validate_payment_method(payment_method)
    if not method:
        return None, "payment_method must be upi or otp."

    net = jeweller_net_balance(jeweller)
    if _active_payment_for_jeweller(jeweller):
        return None, "Finish or cancel the active settlement payment first."

    max_payable = Decimal(net["net_payable_inr"])
    if max_payable <= 0:
        return None, "No platform fees due right now."

    amount = _parse_amount(amount_inr) or max_payable
    if amount > max_payable:
        return None, f"Amount cannot exceed net payable ₹{net['net_payable_inr']}."

    payment = PlatformSettlementPayment.objects.create(
        direction=PlatformSettlementPayment.DIR_JEWELLER_TO_PLATFORM,
        jeweller=jeweller,
        amount_inr=amount,
        payment_method=method,
        status=PlatformSettlementPayment.STATUS_PENDING_PROOF,
        paid_by=jeweller,
    )
    return payment, None


def initiate_admin_payment(
    admin: User,
    *,
    jeweller_id: int,
    amount_inr: Any,
    payment_method: Any = PlatformSettlementPayment.PAY_UPI,
    direction: str = PlatformSettlementPayment.DIR_PLATFORM_TO_JEWELLER,
) -> tuple[PlatformSettlementPayment | None, str | None]:
    method = _validate_payment_method(payment_method)
    if not method:
        return None, "payment_method must be upi or otp."
    if direction not in (
        PlatformSettlementPayment.DIR_PLATFORM_TO_JEWELLER,
        PlatformSettlementPayment.DIR_JEWELLER_TO_PLATFORM,
    ):
        return None, "Invalid direction."

    try:
        jeweller = User.objects.get(pk=jeweller_id, user_type=User.JEWELLER)
    except User.DoesNotExist:
        return None, "Jeweller not found."

    if _active_payment_for_jeweller(jeweller):
        return None, "This jeweller already has an active settlement payment."

    amount = _parse_amount(amount_inr)
    if not amount:
        return None, "amount_inr required."

    if direction == PlatformSettlementPayment.DIR_PLATFORM_TO_JEWELLER:
        net = jeweller_net_balance(jeweller)
        max_credit = Decimal(net["net_credit_inr"])
        if max_credit <= 0:
            return None, "Platform does not owe this jeweller a net credit."
        if amount > max_credit:
            return None, f"Amount cannot exceed net credit ₹{net['net_credit_inr']}."

    payment = PlatformSettlementPayment.objects.create(
        direction=direction,
        jeweller=jeweller,
        amount_inr=amount,
        payment_method=method,
        status=PlatformSettlementPayment.STATUS_PENDING_PROOF,
        paid_by=admin,
    )
    return payment, None


def serialize_payment_initiate_response(payment: PlatformSettlementPayment) -> dict[str, Any]:
    payload = serialize_settlement_payment(payment)
    payload["upi_payment_id"] = payment.pk
    return payload
