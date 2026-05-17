"""API views for cross-redemption MVP (services only; no direct model writes)."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import CrossRedemptionRequest
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
from apps.accounts.services.cross_redemption.ux_map import public_ux_status

User = get_user_model()

MAX_ROWS = 100


def _err(e: CrossRedemptionError, status: int = 400):
    return Response({"code": e.code, "detail": e.message}, status=status)


def _serialize(req: CrossRedemptionRequest, *, viewer: User | None = None) -> dict:
    row: dict = {
        "id": req.pk,
        "ux_status": public_ux_status(req),
        "grams": str(req.grams),
        "estimated_value_inr": str(req.estimated_value_snapshot_inr),
        "source_jeweller_id": req.source_jeweller_id,
        "destination_jeweller_id": req.destination_jeweller_id,
        "deadline_at": req.deadline_at.isoformat() if req.deadline_at else None,
    }
    if viewer is not None:
        if viewer.id == req.destination_jeweller_id:
            row["party"] = "destination"
        elif viewer.id == req.source_jeweller_id:
            row["party"] = "source"
        else:
            row["party"] = ""
        if (
            viewer.id in (req.source_jeweller_id, req.destination_jeweller_id)
            and req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.FULFILLMENT
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
            )
        except CrossRedemptionError as e:
            return _err(e)
        if out.get("status") == "APPROVE" and out.get("request_id"):
            req = CrossRedemptionRequest.objects.filter(pk=out["request_id"]).first()
            out["ux_status"] = public_ux_status(req) if req else "Processing"
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
            .order_by("-id")[:MAX_ROWS]
        )
        return Response({"results": [_serialize(r) for r in qs]})


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
        return Response({"request": _serialize(row)})


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
            .order_by("-id")[:MAX_ROWS]
        )
        return Response({"results": [_serialize(r, viewer=user) for r in qs]})


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
        return Response({"request": _serialize(row, viewer=user)})


class JewellerCrossRedemptionSourceApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=403)
        try:
            row = transition_request(pk, SOURCE_APPROVE, user)
        except CrossRedemptionError as e:
            return _err(e)
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
        return Response({"request": _serialize(row)})


class AdminCrossRedemptionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Staff only."}, status=403)
        qs = CrossRedemptionRequest.objects.order_by("-id")[:MAX_ROWS]
        return Response({"results": [_serialize(r) for r in qs]})
