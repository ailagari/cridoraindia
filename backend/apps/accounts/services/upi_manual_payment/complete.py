"""Completion handlers after UPI proof approval."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.accounts.models import (
    CridoraPayBill,
    FractionalGoldPurchase,
    GoldLoanRepaymentRequest,
    GoldSellbackRequest,
    PlatformSettlementPayment,
)
from apps.accounts.services.payment_reconciliation.confirm import confirm_fractional_purchase
from apps.accounts.services.settlement_payment_service import confirm_settlement_payment
from apps.accounts.sellback_service import settle_sellback

User = get_user_model()


def complete_fractional(entity: FractionalGoldPurchase, by_user: User) -> tuple[bool, str]:
    if entity.status == FractionalGoldPurchase.COMPLETED:
        return True, "Already completed."
    confirm_fractional_purchase(entity, by_user=by_user, decision="jeweller")
    entity.status = FractionalGoldPurchase.COMPLETED
    entity.save(update_fields=["status", "updated_at"])
    return True, "Payment approved."


def complete_loan_repayment(
    entity: GoldLoanRepaymentRequest, by_user: User
) -> tuple[bool, str]:
    from apps.accounts.services.payment_reconciliation.loan_engine import (
        _apply_loan_repayment_confirmed,
    )

    if entity.status == GoldLoanRepaymentRequest.STATUS_COMPLETED:
        return True, "Already completed."
    _apply_loan_repayment_confirmed(entity, by_user)
    return True, "Repayment approved."


def complete_cridorapay(entity: CridoraPayBill, by_user: User) -> tuple[bool, str]:
    from apps.accounts.services.corridorapay.completion import finalize_corridorapay_bill

    if entity.status == CridoraPayBill.STATUS_COMPLETED:
        return True, "Already completed."
    _, err = finalize_corridorapay_bill(entity)
    if err:
        return False, err
    from apps.accounts.services.user_push_notify import notify_corridorapay_completed

    notify_corridorapay_completed(entity)
    return True, "Payment approved."


def complete_sellback(entity: GoldSellbackRequest, by_user: User) -> tuple[bool, str]:
    if entity.status == GoldSellbackRequest.STATUS_COMPLETED:
        return True, "Already completed."
    err = settle_sellback(entity)
    if err:
        return False, err
    return True, "Payout confirmed."


def complete_scheme(entity, by_user: User) -> tuple[bool, str]:
    from apps.schemes.models import SchemeContribution
    from apps.schemes.services.contribution_completion import apply_contribution_completion

    if entity.status == SchemeContribution.COMPLETED:
        return True, "Already completed."
    apply_contribution_completion(entity)
    return True, "Payment approved."


def complete_settlement(
    entity: PlatformSettlementPayment, by_user: User
) -> tuple[bool, str]:
    if entity.status == PlatformSettlementPayment.STATUS_CONFIRMED:
        return True, "Already confirmed."
    confirm_settlement_payment(entity, by_user)
    return True, "Settlement confirmed."
