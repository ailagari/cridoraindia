"""Jeweller on-hold UPI payments API."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services.jeweller_on_hold_desk import jeweller_on_hold_payload

User = get_user_model()


class JewellerOnHoldPaymentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            limit = int(request.query_params.get("limit") or 50)
        except ValueError:
            limit = 50
        return Response(jeweller_on_hold_payload(request.user, limit=limit))
