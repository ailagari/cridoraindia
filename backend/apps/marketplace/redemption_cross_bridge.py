"""Bridge ornament vault checkout with cross-jeweller gram moves."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Sum

from apps.accounts.models import CrossRedemptionRequest, VaultHolding
from apps.accounts.services.cross_redemption.authorization import authorize_cross_redemption
from apps.accounts.services.cross_redemption.ux_map import public_ux_status

User = get_user_model()

_ACTIVE_CR_STAGES = (
    CrossRedemptionRequest.LifecycleStage.AUTH,
    CrossRedemptionRequest.LifecycleStage.FULFILLMENT,
    CrossRedemptionRequest.LifecycleStage.SETTLEMENT,
)


def vault_grams_at_custodian(customer: User, custodian_id: int) -> Decimal:
    total = (
        VaultHolding.objects.filter(
            vault__owner=customer,
            vault__custodian_id=custodian_id,
        ).aggregate(t=Sum("balance_grams"))["t"]
        or Decimal("0")
    )
    return total


def _custodian_balances_excluding(
    customer: User, exclude_jeweller_id: int
) -> list[tuple[int, Decimal]]:
    rows = (
        VaultHolding.objects.filter(vault__owner=customer)
        .exclude(vault__custodian_id=exclude_jeweller_id)
        .values("vault__custodian_id")
        .annotate(total=Sum("balance_grams"))
        .order_by("-total")
    )
    out: list[tuple[int, Decimal]] = []
    for row in rows:
        cid = int(row["vault__custodian_id"])
        total = row["total"] or Decimal("0")
        if total > 0:
            out.append((cid, total))
    return out


def pick_cross_source_jeweller(
    customer: User,
    listing_jeweller_id: int,
    grams_needed: Decimal,
) -> tuple[int, Decimal] | None:
    """Best source custodian with enough spendable grams (prefers default jeweller)."""
    if grams_needed <= 0:
        return None
    candidates = _custodian_balances_excluding(customer, listing_jeweller_id)
    if not candidates:
        return None
    default_id = customer.default_jeweller_id
    if default_id and default_id != listing_jeweller_id:
        for cid, bal in candidates:
            if cid == default_id and bal >= grams_needed:
                return cid, bal
    for cid, bal in candidates:
        if bal >= grams_needed:
            return cid, bal
    return None


def _jeweller_label(j: User) -> str:
    return (j.business_name or j.email or f"Jeweller #{j.pk}").strip()


def _active_cross_request(
    customer: User,
    source_jeweller_id: int,
    destination_jeweller_id: int,
) -> CrossRedemptionRequest | None:
    return (
        CrossRedemptionRequest.objects.filter(
            user=customer,
            source_jeweller_id=source_jeweller_id,
            destination_jeweller_id=destination_jeweller_id,
            lifecycle_stage__in=_ACTIVE_CR_STAGES,
        )
        .select_related("source_jeweller", "destination_jeweller")
        .order_by("-id")
        .first()
    )


def cross_redemption_funded(req: CrossRedemptionRequest) -> bool:
    return req.saga_status == CrossRedemptionRequest.SagaStatus.COMMITTED


def cross_redemption_checkout_status(req: CrossRedemptionRequest) -> str:
    if cross_redemption_funded(req):
        return "Ready"
    if req.workflow_state == CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE:
        return "Awaiting approval"
    return public_ux_status(req)


def build_cross_redemption_quote_addon(
    customer: User,
    *,
    listing_jeweller: User,
    grams_target: Decimal,
    grams_available_at_listing: Decimal,
    metal_rate_inr: Decimal,
) -> dict | None:
    """
    When vault at listing jeweller is short for checkout grams,
    suggest moving gold from another custodian via cross-redemption.
    """
    shortfall = (grams_target - grams_available_at_listing).quantize(Decimal("0.000001"))
    if shortfall <= 0:
        return None

    picked = pick_cross_source_jeweller(customer, listing_jeweller.id, shortfall)
    if not picked:
        return None

    source_id, source_balance = picked
    source = User.objects.filter(pk=source_id, user_type=User.JEWELLER).first()
    if not source:
        return None

    est_inr = (shortfall * metal_rate_inr).quantize(Decimal("0.01"))
    active = _active_cross_request(customer, source_id, listing_jeweller.id)
    active_payload = None
    if active:
        active_payload = {
            "id": active.pk,
            "public_reference": active.public_reference,
            "checkout_status": cross_redemption_checkout_status(active),
            "auth_tier": active.auth_tier,
            "funded": cross_redemption_funded(active),
            "grams": str(active.grams),
        }

    return {
        "needed": True,
        "grams_to_move": str(shortfall),
        "estimated_value_inr": str(est_inr),
        "source_jeweller_id": source_id,
        "source_label": _jeweller_label(source),
        "destination_jeweller_id": listing_jeweller.id,
        "destination_label": _jeweller_label(listing_jeweller),
        "source_vault_grams": str(source_balance),
        "active_request": active_payload,
    }


def authorize_cross_for_ornament_checkout(
    customer: User,
    *,
    product_id: int,
    listing_jeweller: User,
    grams_target: Decimal,
    grams_available_at_listing: Decimal,
    metal_rate_inr: Decimal,
    source_jeweller_id: int | None = None,
) -> dict:
    addon = build_cross_redemption_quote_addon(
        customer,
        listing_jeweller=listing_jeweller,
        grams_target=grams_target,
        grams_available_at_listing=grams_available_at_listing,
        metal_rate_inr=metal_rate_inr,
    )
    if not addon:
        return {"status": "REJECT", "detail": "No eligible source vault for cross-redemption."}

    src_id = source_jeweller_id or int(addon["source_jeweller_id"])
    grams = Decimal(str(addon["grams_to_move"]))
    inr = Decimal(str(addon["estimated_value_inr"]))

    active = addon.get("active_request")
    if active and not active.get("funded"):
        req = CrossRedemptionRequest.objects.filter(pk=active["id"]).first()
        if req:
            return {
                "status": "PENDING" if req.workflow_state == CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE else "APPROVE",
                "request_id": req.pk,
                "public_reference": req.public_reference,
                "checkout_status": cross_redemption_checkout_status(req),
                "funded": False,
                "detail": "Cross-redemption already in progress for this checkout.",
            }

    out = authorize_cross_redemption(
        customer,
        source_jeweller_id=src_id,
        destination_jeweller_id=listing_jeweller.id,
        grams=grams,
        estimated_value_inr=inr,
        initiated_by=customer,
    )
    req_id = out.get("request_id")
    if req_id:
        req = CrossRedemptionRequest.objects.get(pk=req_id)
        meta = dict(req.metadata or {})
        meta["ornament_product_id"] = product_id
        CrossRedemptionRequest.objects.filter(pk=req_id).update(metadata=meta)
        req.refresh_from_db()
        out["checkout_status"] = cross_redemption_checkout_status(req)
        out["funded"] = cross_redemption_funded(req)
    return out
