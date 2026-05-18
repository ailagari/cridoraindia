"""API views for cross-redemption MVP (services only; no direct model writes)."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.cross_redemption_otp import issue_cross_redemption_source_otp
from apps.accounts.models import CrossRedemptionRequest, JewellerCrossPolicy
from apps.accounts.services.cross_redemption.authorization import authorize_cross_redemption
from apps.accounts.services.cross_redemption.exceptions import CrossRedemptionError
from apps.accounts.services.cross_redemption.transitions import (
    DEST_ACCEPT,
    DEST_REJECT,
    FULFILLMENT_HEARTBEAT,
    RISK_BLOCK_CLOSE,
    SETTLEMENT_COMPLETE,
    SOURCE_APPROVE,
    SOURCE_REJECT,
    USER_CANCEL,
    transition_request,
)
from apps.accounts.services.cross_redemption.ux_map import jeweller_inbox_status, public_ux_status

User = get_user_model()

MAX_ROWS = 100


def _err(e: CrossRedemptionError, status: int = 400):
    return Response({"code": e.code, "detail": e.message}, status=status)


def _jeweller_label(u: User) -> str:
    return (u.business_name or u.email or f"Jeweller #{u.pk}").strip()


def _serialize(req: CrossRedemptionRequest, *, viewer: User | None = None) -> dict:
    party = ""
    if viewer is not None:
        if viewer.id == req.destination_jeweller_id:
            party = "destination"
        elif viewer.id == req.source_jeweller_id:
            party = "source"

    row: dict = {
        "id": req.pk,
        "public_reference": req.public_reference or f"CRX-{req.created_at.year}-{req.pk:06d}",
        "ux_status": public_ux_status(req),
        "inbox_status": jeweller_inbox_status(req, party=party) if party else public_ux_status(req),
        "auth_tier": req.auth_tier,
        "workflow_state": req.workflow_state,
        "grams": str(req.grams),
        "estimated_value_inr": str(req.estimated_value_snapshot_inr),
        "source_jeweller_id": req.source_jeweller_id,
        "destination_jeweller_id": req.destination_jeweller_id,
        "source_label": _jeweller_label(req.source_jeweller),
        "destination_label": _jeweller_label(req.destination_jeweller),
        "auth_expires_at": req.auth_expires_at.isoformat() if req.auth_expires_at else None,
        "deadline_at": req.deadline_at.isoformat() if req.deadline_at else None,
        "party": party,
        "can_cancel": viewer is not None and viewer.id == req.user_id and req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.AUTH,
        "needs_source_approval": req.workflow_state == CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE,
    }
    if viewer is not None and viewer.id in (req.source_jeweller_id, req.destination_jeweller_id):
        if (
            req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.FULFILLMENT
            and req.saga_status == CrossRedemptionRequest.SagaStatus.IN_PROGRESS
        ):
            row["lease_holder"] = req.lease_holder
            row["lease_until"] = req.lease_until.isoformat() if req.lease_until else None
    return row


class CustomerCrossRedemptionAuthorizeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=403)
        try:
            src = int(request.data.get("source_jeweller_id"))
            dst = int(request.data.get("destination_jeweller_id"))
            grams = Decimal(str(request.data.get("grams", "0")))
            inr = Decimal(str(request.data.get("estimated_value_inr", "0")))
        except (TypeError, ValueError, InvalidOperation):
            return Response({"detail": "Invalid payload."}, status=400)
        try:
            out = authorize_cross_redemption(
                user,
                source_jeweller_id=src,
                destination_jeweller_id=dst,
                grams=grams,
                estimated_value_inr=inr,
                initiated_by=user,
            )
        except CrossRedemptionError as e:
            return _err(e)
        status = out.get("status")
        if out.get("request_id"):
            req = CrossRedemptionRequest.objects.select_related("source_jeweller", "destination_jeweller").filter(pk=out["request_id"]).first()
            out["ux_status"] = public_ux_status(req) if req else "Processing"
            if req:
                out["request"] = _serialize(req, viewer=user)
        else:
            out["ux_status"] = "Failed"
        return Response(out)


class CustomerCrossRedemptionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=403)
        qs = (
            CrossRedemptionRequest.objects.filter(user=user)
            .select_related("source_jeweller", "destination_jeweller")
            .order_by("-id")[:MAX_ROWS]
        )
        return Response({"results": [_serialize(r, viewer=user) for r in qs]})


class CustomerCrossRedemptionCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=403)
        try:
            row = transition_request(pk, USER_CANCEL, user)
        except CrossRedemptionError as e:
            return _err(e)
        row = CrossRedemptionRequest.objects.select_related("source_jeweller", "destination_jeweller").get(pk=row.pk)
        return Response({"request": _serialize(row, viewer=user)})


class JewellerCrossRedemptionInitiateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=403)
        try:
            customer_id = int(request.data.get("customer_id"))
            src = int(request.data.get("source_jeweller_id"))
            grams = Decimal(str(request.data.get("grams", "0")))
            inr = Decimal(str(request.data.get("estimated_value_inr", "0")))
        except (TypeError, ValueError, InvalidOperation):
            return Response({"detail": "Invalid payload."}, status=400)
        customer = User.objects.filter(pk=customer_id, user_type=User.CUSTOMER).first()
        if not customer:
            return Response({"detail": "Customer not found."}, status=404)
        try:
            out = authorize_cross_redemption(
                customer,
                source_jeweller_id=src,
                destination_jeweller_id=user.id,
                grams=grams,
                estimated_value_inr=inr,
                initiated_by=user,
            )
        except CrossRedemptionError as e:
            return _err(e)
        if out.get("request_id"):
            req = CrossRedemptionRequest.objects.select_related("source_jeweller", "destination_jeweller").get(pk=out["request_id"])
            out["ux_status"] = public_ux_status(req)
            out["request"] = _serialize(req, viewer=user)
        return Response(out)


class JewellerCrossRedemptionInboxView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=403)
        qs = (
            CrossRedemptionRequest.objects.filter(
                Q(destination_jeweller=user) | Q(source_jeweller=user)
            )
            .select_related("source_jeweller", "destination_jeweller", "user")
            .order_by("-id")[:MAX_ROWS]
        )
        return Response({"results": [_serialize(r, viewer=user) for r in qs]})


class JewellerCrossRedemptionSourceOtpView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=403)
        req = CrossRedemptionRequest.objects.filter(pk=pk, source_jeweller=user).first()
        if not req:
            return Response({"detail": "Not found."}, status=404)
        if req.workflow_state != CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE:
            return Response({"detail": "Not awaiting source approval."}, status=400)
        policy = JewellerCrossPolicy.objects.filter(jeweller=user).first()
        ttl = int(policy.auth_expiry_minutes) if policy and policy.auth_expiry_minutes else 15
        try:
            code, expires_at = issue_cross_redemption_source_otp(req, ttl_minutes=ttl)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response({"otp_code": code, "otp_expires_at": expires_at.isoformat()})


class JewellerCrossRedemptionDestAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=403)
        try:
            row = transition_request(pk, DEST_ACCEPT, user)
        except CrossRedemptionError as e:
            return _err(e)
        row = CrossRedemptionRequest.objects.select_related("source_jeweller", "destination_jeweller").get(pk=row.pk)
        return Response({"request": _serialize(row, viewer=user)})


class JewellerCrossRedemptionDestRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=403)
        try:
            row = transition_request(pk, DEST_REJECT, user)
        except CrossRedemptionError as e:
            return _err(e)
        row = CrossRedemptionRequest.objects.select_related("source_jeweller", "destination_jeweller").get(pk=row.pk)
        return Response({"request": _serialize(row, viewer=user)})


class JewellerCrossRedemptionSourceApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=403)
        otp = str(request.data.get("otp") or "").strip()
        try:
            row = transition_request(pk, SOURCE_APPROVE, user, otp=otp)
        except CrossRedemptionError as e:
            return _err(e)
        row = CrossRedemptionRequest.objects.select_related("source_jeweller", "destination_jeweller").get(pk=row.pk)
        return Response({"request": _serialize(row, viewer=user)})


class JewellerCrossRedemptionSourceRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=403)
        try:
            row = transition_request(pk, SOURCE_REJECT, user)
        except CrossRedemptionError as e:
            return _err(e)
        row = CrossRedemptionRequest.objects.select_related("source_jeweller", "destination_jeweller").get(pk=row.pk)
        return Response({"request": _serialize(row, viewer=user)})


class JewellerCrossRedemptionFulfillmentHeartbeatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=403)
        holder = str(request.data.get("lease_holder") or "").strip()
        try:
            row = transition_request(pk, FULFILLMENT_HEARTBEAT, user, lease_holder=holder)
        except CrossRedemptionError as e:
            return _err(e)
        row = CrossRedemptionRequest.objects.select_related("source_jeweller", "destination_jeweller").get(pk=row.pk)
        return Response({"request": _serialize(row, viewer=user)})


class AdminCrossRedemptionRiskBlockView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if not user.is_staff:
            return Response({"detail": "Staff only."}, status=403)
        try:
            row = transition_request(pk, RISK_BLOCK_CLOSE, user)
        except CrossRedemptionError as e:
            return _err(e)
        row = CrossRedemptionRequest.objects.select_related("source_jeweller", "destination_jeweller").get(pk=row.pk)
        return Response({"request": _serialize(row)})


class AdminCrossRedemptionSettlementCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if not user.is_staff:
            return Response({"detail": "Staff only."}, status=403)
        try:
            row = transition_request(pk, SETTLEMENT_COMPLETE, user)
        except CrossRedemptionError as e:
            return _err(e)
        row = CrossRedemptionRequest.objects.select_related("source_jeweller", "destination_jeweller").get(pk=row.pk)
        return Response({"request": _serialize(row)})


class AdminCrossRedemptionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Staff only."}, status=403)
        qs = CrossRedemptionRequest.objects.select_related("source_jeweller", "destination_jeweller").order_by("-id")[:MAX_ROWS]
        return Response({"results": [_serialize(r) for r in qs]})
