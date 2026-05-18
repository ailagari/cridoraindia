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
from apps.accounts.services.cross_redemption.limits import classify_auth_tier
from apps.accounts.services.cross_redemption.reference import cross_redemption_public_reference

User = get_user_model()

_DEFAULT_POLICY = {
    "require_source_approval": False,
    "instant_enabled": False,
    "allow_cross_redemption": True,
    "auto_cross_grams_per_day": Decimal("20"),
    "auto_cross_inr_per_day": Decimal("200000"),
    "single_txn_gram_limit": Decimal("10"),
    "single_txn_inr_limit": Decimal("100000"),
    "daily_txn_count_limit": 25,
    "auth_expiry_minutes": 15,
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
    initiated_by: User | None = None,
) -> dict:
    """
    Creates CrossRedemptionRequest in AUTH + ACTIVE ExposureReservation.
    Source jeweller owns approval (Tier 1 auto or Tier 2 manual pending).
    Returns: status APPROVE|PENDING|REJECT, request_id, auth_tier, public_reference, ux_lane, reason_codes.
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
        return {"status": "REJECT", "request_id": None, "auth_tier": "", "public_reference": "", "ux_lane": "", "reason_codes": ["insufficient_grams"]}

    policy_a = _policy(src)
    policy_b = _policy(dst)
    if not policy_a.allow_cross_redemption or not policy_b.allow_cross_redemption:
        return {"status": "REJECT", "request_id": None, "auth_tier": "", "public_reference": "", "ux_lane": "", "reason_codes": ["cross_disabled"]}

    dest_today = _active_reservation_sum_dest_today(dst.id)
    if dest_today + estimated_value_inr > policy_b.max_daily_exposure_inr:
        return {"status": "REJECT", "request_id": None, "auth_tier": "", "public_reference": "", "ux_lane": "", "reason_codes": ["dest_daily_cap"]}

    pending_src = (
        _active_reservation_sum_source(src.id)
        + _pending_obligation_sum_from(src.id)
        + estimated_value_inr
    )
    if pending_src > _max_exposure_inr(policy_a):
        return {"status": "REJECT", "request_id": None, "auth_tier": "", "public_reference": "", "ux_lane": "", "reason_codes": ["source_exposure_cap"]}

    tier, tier_reasons = classify_auth_tier(
        policy_a,
        grams=grams,
        inr=estimated_value_inr,
        source_jeweller_id=src.id,
    )
    if tier == "reject":
        return {"status": "REJECT", "request_id": None, "auth_tier": "", "public_reference": "", "ux_lane": "", "reason_codes": tier_reasons}

    instant_ok = (
        policy_a.instant_enabled
        and policy_b.instant_enabled
        and policy_a.trust_tier >= 1
        and policy_b.trust_tier >= 1
    )
    ux_lane = "instant" if instant_ok else "delayed"
    settlement_due = timezone.now() + timedelta(hours=int(policy_b.settlement_delay_hours))
    auth_expires = timezone.now() + timedelta(minutes=int(policy_a.auth_expiry_minutes or 15))
    auth_tier = CrossRedemptionRequest.AuthTier.AUTO if tier == "auto" else CrossRedemptionRequest.AuthTier.MANUAL

    with transaction.atomic():
        req = CrossRedemptionRequest.objects.create(
            user=customer,
            source_jeweller=src,
            destination_jeweller=dst,
            grams=grams,
            estimated_value_snapshot_inr=estimated_value_inr,
            lifecycle_stage=CrossRedemptionRequest.LifecycleStage.AUTH,
            workflow_state=CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE,
            auth_tier=auth_tier,
            auth_expires_at=auth_expires,
            ux_lane=ux_lane,
            deadline_at=settlement_due,
            metadata={
                "authorize_at": timezone.now().isoformat(),
                "tier_reasons": tier_reasons,
                "initiated_by_id": initiated_by.pk if initiated_by else None,
            },
        )
        ref = cross_redemption_public_reference(req.pk)
        CrossRedemptionRequest.objects.filter(pk=req.pk).update(public_reference=ref)
        req.public_reference = ref
        ExposureReservation.objects.create(
            request=req,
            source_jeweller=src,
            destination_jeweller=dst,
            reserved_value_inr=estimated_value_inr,
            status=ExposureReservation.Status.ACTIVE,
        )
        actor = CrossRedemptionEvent.Actor.SYSTEM
        if initiated_by and initiated_by.user_type == User.JEWELLER:
            actor = CrossRedemptionEvent.Actor.JEWELLER_DEST
        elif initiated_by and initiated_by.pk == customer.pk:
            actor = CrossRedemptionEvent.Actor.USER
        log_event(
            req,
            actor=actor,
            event_type="authorized",
            payload={
                "auth_tier": auth_tier,
                "ux_lane": ux_lane,
                "auth_expires_at": auth_expires.isoformat(),
                "deadline_at": settlement_due.isoformat(),
            },
        )

    if auth_tier == CrossRedemptionRequest.AuthTier.AUTO:
        from apps.accounts.services.cross_redemption.transitions import auto_commit_after_authorize

        auto_commit_after_authorize(req.pk)
        req = CrossRedemptionRequest.objects.get(pk=req.pk)
        return {
            "status": "APPROVE",
            "request_id": req.pk,
            "auth_tier": auth_tier,
            "public_reference": req.public_reference,
            "ux_lane": ux_lane,
            "reason_codes": [],
        }

    return {
        "status": "PENDING",
        "request_id": req.pk,
        "auth_tier": auth_tier,
        "public_reference": req.public_reference,
        "ux_lane": ux_lane,
        "reason_codes": tier_reasons,
    }
