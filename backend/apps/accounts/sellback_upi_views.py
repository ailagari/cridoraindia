"""Online UPI sellback payout views (Model A reversed — jeweller pays customer)."""

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GoldSellbackRequest
from .platform_features import FeatureGatedViewMixin
from .sellback_service import customer_confirm_sellback_utr
from .sellback_views import _serialize_customer_outstanding, _serialize_sellback_jeweller
from .services.sellback_upi import (
    cancel_upi_sellback,
    normalize_upi_vpa,
    payout_payload_for,
    submit_utr_for_jeweller,
)

User = get_user_model()


class CustomerPayoutUpiProfileView(FeatureGatedViewMixin, APIView):
    feature_key = "sellback_upi"
    """Customer configures UPI VPA for sellback payouts."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        vpa = normalize_upi_vpa(request.user.payout_upi_vpa or "")
        return Response(
            {
                "payout_upi_vpa": vpa or "",
                "configured": bool(vpa),
            }
        )

    def patch(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        if request.user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {"detail": "Complete verified KYC before configuring payout UPI."},
                status=status.HTTP_403_FORBIDDEN,
            )
        data = request.data if isinstance(request.data, dict) else {}
        raw = str(data.get("payout_upi_vpa") or "").strip()
        if raw == "":
            request.user.payout_upi_vpa = ""
            request.user.save(update_fields=["payout_upi_vpa"])
            return Response({"payout_upi_vpa": "", "configured": False})
        vpa = normalize_upi_vpa(raw)
        if not vpa:
            return Response(
                {"detail": "Invalid UPI ID. Use format name@bank."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.payout_upi_vpa = vpa
        request.user.save(update_fields=["payout_upi_vpa"])
        return Response({"payout_upi_vpa": vpa, "configured": True})


class JewellerSellbackPayoutView(FeatureGatedViewMixin, APIView):
    feature_key = "sellback_upi"
    """Payout instructions for an accepted UPI sellback."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        row = GoldSellbackRequest.objects.filter(
            pk=pk,
            jeweller=request.user,
            payment_method=GoldSellbackRequest.PAY_UPI,
        ).select_related("customer").first()
        if not row:
            return Response({"detail": "UPI sellback not found."}, status=status.HTTP_404_NOT_FOUND)
        payload = _serialize_sellback_jeweller(row)
        payload["payout"] = payout_payload_for(row)
        return Response(payload)


class JewellerSellbackSubmitUtrView(FeatureGatedViewMixin, APIView):
    feature_key = "sellback_upi"
    """Jeweller submits UPI reference after paying the customer."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        raw_utr = ""
        if isinstance(request.data, dict):
            raw_utr = str(request.data.get("utr") or "")
        try:
            with transaction.atomic():
                row = GoldSellbackRequest.objects.select_for_update().get(
                    pk=pk,
                    jeweller=request.user,
                    payment_method=GoldSellbackRequest.PAY_UPI,
                )
                ok, detail = submit_utr_for_jeweller(row, raw_utr)
                if not ok:
                    return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)
        except GoldSellbackRequest.DoesNotExist:
            return Response({"detail": "UPI sellback not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_sellback_jeweller(row))


class CustomerSellbackConfirmUtrView(FeatureGatedViewMixin, APIView):
    feature_key = "sellback_upi"
    """Customer confirms UTR after receiving UPI payout."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        row, err = customer_confirm_sellback_utr(request.user, pk)
        if err or row is None:
            return Response(
                {"detail": err or "Could not confirm payout."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "detail": "Sellback settled. Vault grams debited.",
                "sellback": _serialize_customer_outstanding(row),
            }
        )


class CustomerSellbackCancelUpiView(FeatureGatedViewMixin, APIView):
    feature_key = "sellback_upi"
    """Customer cancels a pending UPI sellback."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            with transaction.atomic():
                row = GoldSellbackRequest.objects.select_for_update().get(
                    pk=pk,
                    customer=request.user,
                    payment_method=GoldSellbackRequest.PAY_UPI,
                )
                ok, detail = cancel_upi_sellback(row)
                if not ok:
                    return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)
        except GoldSellbackRequest.DoesNotExist:
            return Response({"detail": "UPI sellback not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_customer_outstanding(row))
