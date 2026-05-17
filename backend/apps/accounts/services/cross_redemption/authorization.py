"""Pre-capacity authorization for cross redemption (no gram movement)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import (
    CrossRedemptionEvent,
    CrossRedemptionRequest,
    ExposureReservation,
    GoldVault,
    JewellerCrossPolicy,
    SettlementObligation,
    VaultHolding,
)
from apps.accounts.services.cross_redemption.events import log_event
from apps.accounts.services.cross_redemption.exceptions import CrossRedemptionError

User = get_user_model()

_DEFAULT_POLICY = {
    "require_source_approval": False,
    "instant_enabled": False,
    "allow_cross_redemption": True,
    "trust_tier": 0,
    "settlement_delay_hours": 24,
    "max_daily_exposure_inr": Decimal("500000"),
    "max_pending_liability_inr": Decimal("10000000"),
    "reserve_balance_inr": Decimal("0"),
    "risk_multiplier": Decimal("3"),
}


def _policy(j: User) -> JewellerCrossPolicy:
    p, _ = JewellerCrossPolicy.objects.get_or_create(jeweller=j, defaults=_DEFAULT_POLICY.copy())
    return p


def _vault_spendable_grams(customer: User, custodian: User) -> Decimal:
    vault = GoldVault.objects.filter(owner=customer, custodian=custodian).first()
    if not vault:
        return Decimal("0")
    t = VaultHolding.objects.filter(vault=vault).aggregate(s=Sum("balance_grams"))["s"]
    return t if t is not None else Decimal("0")


def _active_reservation_sum_dest_today(dest_id: int) -> Decimal:
    start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    rows = ExposureReservation.objects.filter(
        destination_jeweller_id=dest_id,
        status=ExposureReservation.Status.ACTIVE,
        created_at__gte=start,
    ).aggregate(t=Sum("reserved_value_inr"))["t"]
    return rows or Decimal("0")


def _active_reservation_sum_source(source_id: int) -> Decimal:
    rows = (
        ExposureReservation.objects.filter(
            source_jeweller_id=source_id,
            status=ExposureReservation.Status.ACTIVE,
        ).aggregate(t=Sum("reserved_value_inr"))["t"]
    )
    return rows or Decimal("0")


def _pending_obligation_sum_from(source_id: int) -> Decimal:
    rows = (
        SettlementObligation.objects.filter(
            from_jeweller_id=source_id,
            status=SettlementObligation.Status.PENDING,
        ).aggregate(t=Sum("amount_inr"))["t"]
    )
    return rows or Decimal("0")


def _max_exposure_inr(p: JewellerCrossPolicy) -> Decimal:
    cap = p.reserve_balance_inr * p.risk_multiplier
    if cap <= 0:
        return p.max_pending_liability_inr
    return min(cap, p.max_pending_liability_inr)


def authorize_cross_redemption(
    customer: User,
    *,
    source_jeweller_id: int,
    destination_jeweller_id: int,
    grams: Decimal,
    estimated_value_inr: Decimal,
) -> dict:
    """
    Creates CrossRedemptionRequest in AUTH + ACTIVE ExposureReservation.
    Returns: status APPROVE|REJECT, request_id, ux_lane instant|delayed, reason_codes.
    """
    if customer.user_type != User.CUSTOMER:
        raise CrossRedemptionError("invalid_actor", "Customers only.")
    if source_jeweller_id == destination_jeweller_id:
        raise CrossRedemptionError("risk_block", "Source and destination must differ.")
    if grams <= 0:
        raise CrossRedemptionError("invalid_grams", "Grams must be positive.")
    if estimated_value_inr <= 0:
        raise CrossRedemptionError("invalid_value", "estimated_value_inr must be positive.")

    src = User.objects.filter(pk=source_jeweller_id, user_type=User.JEWELLER).first()
    dst = User.objects.filter(pk=destination_jeweller_id, user_type=User.JEWELLER).first()
    if not src or not dst:
        raise CrossRedemptionError("not_found", "Jeweller not found.")

    available = _vault_spendable_grams(customer, src)
    if available + Decimal("0.0000001") < grams:
        return {"status": "REJECT", "request_id": None, "ux_lane": "", "reason_codes": ["insufficient_grams"]}

    policy_a = _policy(src)
    policy_b = _policy(dst)
    if not policy_a.allow_cross_redemption or not policy_b.allow_cross_redemption:
        return {"status": "REJECT", "request_id": None, "ux_lane": "", "reason_codes": ["cross_disabled"]}

    dest_today = _active_reservation_sum_dest_today(dst.id)
    if dest_today + estimated_value_inr > policy_b.max_daily_exposure_inr:
        return {"status": "REJECT", "request_id": None, "ux_lane": "", "reason_codes": ["dest_daily_cap"]}

    pending_src = (
        _active_reservation_sum_source(src.id)
        + _pending_obligation_sum_from(src.id)
        + estimated_value_inr
    )
    if pending_src > _max_exposure_inr(policy_a):
        return {"status": "REJECT", "request_id": None, "ux_lane": "", "reason_codes": ["source_exposure_cap"]}

    instant_ok = (
        policy_a.instant_enabled
        and policy_b.instant_enabled
        and policy_a.trust_tier >= 1
        and policy_b.trust_tier >= 1
    )
    ux_lane = "instant" if instant_ok else "delayed"
    delay_h = policy_b.settlement_delay_hours
    deadline = timezone.now() + timedelta(hours=int(delay_h))

    with transaction.atomic():
        req = CrossRedemptionRequest.objects.create(
            user=customer,
            source_jeweller=src,
            destination_jeweller=dst,
            grams=grams,
            estimated_value_snapshot_inr=estimated_value_inr,
            lifecycle_stage=CrossRedemptionRequest.LifecycleStage.AUTH,
            workflow_state=CrossRedemptionRequest.WorkflowState.AWAITING_DESTINATION,
            ux_lane=ux_lane,
            deadline_at=deadline,
            metadata={"authorize_at": timezone.now().isoformat()},
        )
        ExposureReservation.objects.create(
            request=req,
            source_jeweller=src,
            destination_jeweller=dst,
            reserved_value_inr=estimated_value_inr,
            status=ExposureReservation.Status.ACTIVE,
        )
        log_event(
            req,
            actor=CrossRedemptionEvent.Actor.SYSTEM,
            event_type="authorized",
            payload={"ux_lane": ux_lane, "deadline_at": deadline.isoformat()},
        )

    return {"status": "APPROVE", "request_id": req.pk, "ux_lane": ux_lane, "reason_codes": []}
