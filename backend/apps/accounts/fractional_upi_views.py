"""Online UPI fractional purchase views (Model A — jeweller VPA + paste UTR)."""

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.marketplace.models import jeweller_profile_for

from .fractional_reconciliation_views import JewellerFractionalApproveView
from .platform_features import FeatureGatedViewMixin
from .fractional_views import _ser_purchase
from .models import FractionalGoldPurchase
from .services.fractional_upi import (
    cancel_upi_order,
    jeweller_upi_vpa,
    normalize_upi_vpa,
    order_reference_cr,
    payment_payload_for,
    submit_utr,
)

User = get_user_model()


class FractionalOrderPaymentView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    """Payment instructions for a pending UPI fractional order."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Customers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        purchase = FractionalGoldPurchase.objects.filter(
            pk=pk,
            customer=request.user,
            payment_method=FractionalGoldPurchase.PAY_UPI,
        ).select_related("jeweller").first()
        if not purchase:
            return Response(
                {"detail": "UPI order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        payload = _ser_purchase(purchase)
        payload["payment"] = payment_payload_for(purchase)
        return Response(payload)


class FractionalOrderSubmitUtrView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    """Customer submits UPI reference after paying the jeweller."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Customers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        raw_utr = ""
        if isinstance(request.data, dict):
            raw_utr = str(request.data.get("utr") or "")
        try:
            with transaction.atomic():
                purchase = FractionalGoldPurchase.objects.select_for_update().get(
                    pk=pk,
                    customer=request.user,
                    payment_method=FractionalGoldPurchase.PAY_UPI,
                )
                ok, detail = submit_utr(purchase, raw_utr)
                if not ok:
                    return Response(
                        {"detail": detail},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        except FractionalGoldPurchase.DoesNotExist:
            return Response(
                {"detail": "UPI order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_ser_purchase(purchase))


class FractionalOrderCancelUpiView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    """Customer cancels an unpaid UPI fractional order."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Customers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            with transaction.atomic():
                purchase = FractionalGoldPurchase.objects.select_for_update().get(
                    pk=pk,
                    customer=request.user,
                    payment_method=FractionalGoldPurchase.PAY_UPI,
                )
                ok, detail = cancel_upi_order(purchase)
                if not ok:
                    return Response(
                        {"detail": detail},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        except FractionalGoldPurchase.DoesNotExist:
            return Response(
                {"detail": "UPI order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_ser_purchase(purchase))


class JewellerFractionalPendingUpiView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        qs = FractionalGoldPurchase.objects.filter(
            jeweller=request.user,
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status__in=(
                FractionalGoldPurchase.PENDING_REVIEW,
                FractionalGoldPurchase.NEEDS_MANUAL_VERIFICATION,
                FractionalGoldPurchase.AWAITING_UTR_VERIFY,
            ),
        ).select_related("customer")[:100]
        out = []
        for p in qs:
            row = _ser_purchase(p)
            row["customer"] = {
                "email": p.customer.email,
                "name": f"{p.customer.first_name} {p.customer.last_name}".strip(),
                "cridora_member_id": p.customer.cridora_member_id or "",
            }
            out.append(row)
        return Response({"results": out})


class JewellerFractionalConfirmUtrView(JewellerFractionalApproveView):
    """Legacy alias for jeweller approve."""


class JewellerUpiProfileView(APIView):
    """Jeweller configures UPI VPA for online fractional payments."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = jeweller_profile_for(request.user)
        return Response(
            {
                "upi_vpa": profile.upi_vpa or "",
                "upi_display_name": profile.upi_display_name or "",
                "configured": bool(jeweller_upi_vpa(request.user)),
            }
        )

    def patch(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if request.user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {"detail": "Complete KYB verification before configuring UPI."},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = jeweller_profile_for(request.user)
        data = request.data if isinstance(request.data, dict) else {}
        updates: list[str] = []
        if "upi_vpa" in data:
            raw = str(data.get("upi_vpa") or "").strip()
            if raw == "":
                profile.upi_vpa = ""
                updates.append("upi_vpa")
            else:
                vpa = normalize_upi_vpa(raw)
                if not vpa:
                    return Response(
                        {"detail": "Invalid UPI ID. Use format name@bank."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                profile.upi_vpa = vpa
                updates.append("upi_vpa")
        if "upi_display_name" in data:
            profile.upi_display_name = str(data.get("upi_display_name") or "").strip()[:80]
            updates.append("upi_display_name")
        if updates:
            profile.save(update_fields=[*updates, "updated_at"])
        return Response(
            {
                "upi_vpa": profile.upi_vpa or "",
                "upi_display_name": profile.upi_display_name or "",
                "configured": bool(jeweller_upi_vpa(request.user)),
            }
        )
