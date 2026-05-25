"""Maps UPI payment kind strings to models, roles, and completion handlers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType

from apps.accounts.models import (
    CridoraPayBill,
    FractionalGoldPurchase,
    GoldLoanRepaymentRequest,
    GoldSellbackRequest,
    PlatformSettlementPayment,
    User,
)
from apps.accounts.services.admin_access import user_is_platform_admin

UserModel = get_user_model()


def _settlement_is_upi(entity: Any) -> bool:
    return getattr(entity, "payment_method", PlatformSettlementPayment.PAY_UPI) == PlatformSettlementPayment.PAY_UPI

KIND_FRACTIONAL = "fractional"
KIND_LOAN_REPAYMENT = "loan_repayment"
KIND_CRIDORAPAY = "cridorapay"
KIND_SELLBACK = "sellback"
KIND_SETTLEMENT = "settlement"

VALID_KINDS = frozenset(
    {
        KIND_FRACTIONAL,
        KIND_LOAN_REPAYMENT,
        KIND_CRIDORAPAY,
        KIND_SELLBACK,
        KIND_SETTLEMENT,
    }
)


@dataclass(frozen=True)
class UpiKindSpec:
    kind: str
    model: type
    payer_role: str
    reviewer_role: str
    pending_review_status: str
    proof_rejected_status: str
    on_hold_status: str
    completed_status: str
    payer_submit_statuses: tuple[str, ...]


def _fractional_spec() -> UpiKindSpec:
    m = FractionalGoldPurchase
    return UpiKindSpec(
        kind=KIND_FRACTIONAL,
        model=m,
        payer_role=User.CUSTOMER,
        reviewer_role=User.JEWELLER,
        pending_review_status=m.PENDING_REVIEW,
        proof_rejected_status=m.PROOF_REJECTED,
        on_hold_status=m.ON_HOLD,
        completed_status=m.COMPLETED,
        payer_submit_statuses=(
            m.PENDING_PAYMENT,
            m.SIGNAL_RECEIVED,
            m.PROOF_REJECTED,
        ),
    )


def _loan_spec() -> UpiKindSpec:
    m = GoldLoanRepaymentRequest
    return UpiKindSpec(
        kind=KIND_LOAN_REPAYMENT,
        model=m,
        payer_role=User.CUSTOMER,
        reviewer_role=User.JEWELLER,
        pending_review_status=m.STATUS_PENDING_REVIEW,
        proof_rejected_status=m.STATUS_PROOF_REJECTED,
        on_hold_status=m.STATUS_ON_HOLD,
        completed_status=m.STATUS_COMPLETED,
        payer_submit_statuses=(
            m.STATUS_PENDING_PAYMENT,
            m.STATUS_SIGNAL_RECEIVED,
            m.STATUS_PROOF_REJECTED,
        ),
    )


def _cridorapay_spec() -> UpiKindSpec:
    m = CridoraPayBill
    return UpiKindSpec(
        kind=KIND_CRIDORAPAY,
        model=m,
        payer_role=User.CUSTOMER,
        reviewer_role=User.JEWELLER,
        pending_review_status=m.STATUS_PENDING_REVIEW,
        proof_rejected_status=m.STATUS_PROOF_REJECTED,
        on_hold_status=m.STATUS_ON_HOLD,
        completed_status=m.STATUS_COMPLETED,
        payer_submit_statuses=(
            m.STATUS_UPI_PENDING,
            m.STATUS_PROOF_REJECTED,
        ),
    )


def _sellback_spec() -> UpiKindSpec:
    m = GoldSellbackRequest
    return UpiKindSpec(
        kind=KIND_SELLBACK,
        model=m,
        payer_role=User.JEWELLER,
        reviewer_role=User.CUSTOMER,
        pending_review_status=m.STATUS_PENDING_REVIEW,
        proof_rejected_status=m.STATUS_PROOF_REJECTED,
        on_hold_status=m.STATUS_ON_HOLD,
        completed_status=m.STATUS_COMPLETED,
        payer_submit_statuses=(
            m.STATUS_ACCEPTED_AWAITING_OTP,
            m.STATUS_PROOF_REJECTED,
        ),
    )


def _settlement_spec() -> UpiKindSpec:
    m = PlatformSettlementPayment
    return UpiKindSpec(
        kind=KIND_SETTLEMENT,
        model=m,
        payer_role=User.JEWELLER,
        reviewer_role=User.ADMIN,
        pending_review_status=m.STATUS_SUBMITTED,
        proof_rejected_status=m.STATUS_REJECTED,
        on_hold_status=m.STATUS_REJECTED,
        completed_status=m.STATUS_CONFIRMED,
        payer_submit_statuses=(
            m.STATUS_PENDING_PROOF,
            m.STATUS_REJECTED,
        ),
    )


_SPECS: dict[str, UpiKindSpec] = {
    KIND_FRACTIONAL: _fractional_spec(),
    KIND_LOAN_REPAYMENT: _loan_spec(),
    KIND_CRIDORAPAY: _cridorapay_spec(),
    KIND_SELLBACK: _sellback_spec(),
    KIND_SETTLEMENT: _settlement_spec(),
}


def get_spec(kind: str) -> UpiKindSpec:
    if kind not in _SPECS:
        raise ValueError(f"Unknown UPI kind: {kind}")
    return _SPECS[kind]


def load_entity(kind: str, pk: int) -> Any:
    spec = get_spec(kind)
    qs = spec.model.objects
    if kind == KIND_LOAN_REPAYMENT:
        qs = qs.select_related("loan", "loan__customer", "loan__jeweller")
    elif kind == KIND_SELLBACK:
        qs = qs.select_related("customer", "jeweller")
    elif kind == KIND_FRACTIONAL:
        qs = qs.select_related("customer", "jeweller")
    elif kind == KIND_CRIDORAPAY:
        qs = qs.select_related("customer", "jeweller")
    elif kind == KIND_SETTLEMENT:
        qs = qs.select_related("jeweller")
    return qs.get(pk=pk)


def content_type_for(kind: str) -> ContentType:
    spec = get_spec(kind)
    return ContentType.objects.get_for_model(spec.model)


def user_can_payer(user: UserModel, kind: str, entity: Any) -> bool:
    if kind == KIND_SETTLEMENT:
        if not _settlement_is_upi(entity):
            return False
        if entity.direction == PlatformSettlementPayment.DIR_JEWELLER_TO_PLATFORM:
            return user.user_type == User.JEWELLER and entity.jeweller_id == user.pk
        if entity.direction == PlatformSettlementPayment.DIR_PLATFORM_TO_JEWELLER:
            return user_is_platform_admin(user)
        return False
    spec = get_spec(kind)
    if user.user_type != spec.payer_role:
        return False
    if kind == KIND_FRACTIONAL:
        return entity.customer_id == user.pk
    if kind == KIND_LOAN_REPAYMENT:
        return entity.loan.customer_id == user.pk
    if kind == KIND_CRIDORAPAY:
        return entity.customer_id == user.pk
    if kind == KIND_SELLBACK:
        return entity.jeweller_id == user.pk
    return False


def user_can_reviewer(user: UserModel, kind: str, entity: Any) -> bool:
    if kind == KIND_SETTLEMENT:
        if not _settlement_is_upi(entity):
            return False
        if entity.direction == PlatformSettlementPayment.DIR_JEWELLER_TO_PLATFORM:
            return user_is_platform_admin(user)
        if entity.direction == PlatformSettlementPayment.DIR_PLATFORM_TO_JEWELLER:
            return user.user_type == User.JEWELLER and entity.jeweller_id == user.pk
        return False
    spec = get_spec(kind)
    if user.user_type != spec.reviewer_role:
        return False
    if kind == KIND_FRACTIONAL:
        return entity.jeweller_id == user.pk
    if kind == KIND_LOAN_REPAYMENT:
        return entity.loan.jeweller_id == user.pk
    if kind == KIND_CRIDORAPAY:
        return entity.jeweller_id == user.pk
    if kind == KIND_SELLBACK:
        return entity.customer_id == user.pk
    return False


CompletionFn = Callable[[Any, UserModel], tuple[bool, str]]


def get_completion_fn(kind: str) -> CompletionFn:
    if kind == KIND_FRACTIONAL:
        from .complete import complete_fractional

        return complete_fractional
    if kind == KIND_LOAN_REPAYMENT:
        from .complete import complete_loan_repayment

        return complete_loan_repayment
    if kind == KIND_CRIDORAPAY:
        from .complete import complete_cridorapay

        return complete_cridorapay
    if kind == KIND_SELLBACK:
        from .complete import complete_sellback

        return complete_sellback
    if kind == KIND_SETTLEMENT:
        from .complete import complete_settlement

        return complete_settlement
    raise ValueError(f"Unknown kind: {kind}")
