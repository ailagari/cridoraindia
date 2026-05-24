"""Jeweller unified purchase desk API."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services.jeweller_unified_desk import jeweller_unified_desk_payload

User = get_user_model()


class JewellerUnifiedDeskTransactionsView(APIView):
    """GET /api/v1/jeweller/desk/transactions/ — all customer↔jeweller flows."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)

        bucket = (request.query_params.get("bucket") or "pending").strip().lower()
        txn_type = (request.query_params.get("type") or "").strip()
        payment_method = (request.query_params.get("method") or "").strip()
        try:
            limit = int(request.query_params.get("limit") or 50)
        except ValueError:
            limit = 50
        try:
            offset = int(request.query_params.get("offset") or 0)
        except ValueError:
            offset = 0

        payload = jeweller_unified_desk_payload(
            request.user,
            bucket=bucket,
            txn_type=txn_type,
            payment_method=payment_method,
            limit=limit,
            offset=offset,
        )
        return Response(payload)
