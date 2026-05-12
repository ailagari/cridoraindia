from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .fractional_service import (
    GST_PERCENT,
    breakdown_from_grams,
    breakdown_from_total_inr,
    jeweller_metal_rate_inr_per_gram,
    validate_minimums,
)
from .models import FractionalGoldPurchase, GoldBalance
from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

User = get_user_model()


def _ser_jeweller_brief(j: User) -> dict:
    return {
        "id": j.id,
        "business_name": j.business_name or j.email,
        "city": j.city or "",
    }


def _ser_purchase(p: FractionalGoldPurchase) -> dict:
    return {
        "id": p.id,
        "reference": f"FR-{p.id}",
        "jeweller": _ser_jeweller_brief(p.jeweller),
        "metal_rate_inr_per_gram": str(p.metal_rate_inr_per_gram),
        "grams": str(p.grams),
        "gold_value_inr_pre_gst": str(p.gold_value_inr_pre_gst),
        "gst_percent": str(p.gst_percent),
        "gst_inr": str(p.gst_inr),
        "total_inr": str(p.total_inr),
        "payment_method": p.payment_method,
        "status": p.status,
        "customer_note": p.customer_note,
        "created_at": p.created_at.isoformat(),
        "jeweller_verified_at": p.jeweller_verified_at.isoformat()
        if p.jeweller_verified_at
        else None,
    }


def _credit_customer_gold(customer: User, grams: Decimal) -> None:
    GoldBalance.objects.select_for_update().get_or_create(
        user=customer, defaults={"balance_grams": Decimal("0")}
    )
    GoldBalance.objects.filter(user=customer).update(
        balance_grams=F("balance_grams") + grams
    )


class FractionalQuoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Only customers can request quotes."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            jid = int(request.data.get("jeweller_id"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "jeweller_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        jeweller = User.objects.filter(
            pk=jid, user_type=User.JEWELLER, kyc_status=User.KYC_VERIFIED
        ).first()
        if not jeweller:
            return Response(
                {"detail": "Verified jeweller not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        mode = (request.data.get("mode") or "").strip().lower()
        rate = jeweller_metal_rate_inr_per_gram(jeweller)
        try:
            if mode == "by_grams":
                g = Decimal(str(request.data.get("grams", "0")))
                b = breakdown_from_grams(g, rate)
            elif mode == "by_total_inr":
                total = Decimal(str(request.data.get("total_inr", "0")))
                b = breakdown_from_total_inr(total, rate)
            else:
                return Response(
                    {"detail": "mode must be by_grams or by_total_inr."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception:
            return Response(
                {"detail": "Invalid amount. Use a valid number."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        err = validate_minimums(b)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        cridora_base, _ = resolve_cridora_base_22k_inr()
        return Response(
            {
                "jeweller": _ser_jeweller_brief(jeweller),
                "metal_rate_inr_per_gram": str(rate),
                "platform_base_inr_per_gram_22k": str(cridora_base),
                "grams": str(b["grams"]),
                "gold_value_inr_pre_gst": str(b["gold_value_inr_pre_gst"]),
                "gst_percent": str(b["gst_percent"]),
                "gst_inr": str(b["gst_inr"]),
                "total_inr": str(b["total_inr"]),
            }
        )


class FractionalOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Customers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        qs = FractionalGoldPurchase.objects.filter(customer=request.user).select_related(
            "jeweller"
        )[:50]
        return Response({"results": [_ser_purchase(p) for p in qs]})

    def post(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Only customers can purchase."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {"detail": "Complete KYC before purchasing gold."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            jid = int(request.data.get("jeweller_id"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "jeweller_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        jeweller = User.objects.filter(
            pk=jid, user_type=User.JEWELLER, kyc_status=User.KYC_VERIFIED
        ).first()
        if not jeweller:
            return Response(
                {"detail": "Verified jeweller not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pay = (request.data.get("payment_method") or "").strip().lower()
        if pay not in (FractionalGoldPurchase.PAY_UPI, FractionalGoldPurchase.PAY_COUNTER):
            return Response(
                {"detail": "payment_method must be upi or counter."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        mode = (request.data.get("mode") or "").strip().lower()
        rate = jeweller_metal_rate_inr_per_gram(jeweller)
        try:
            if mode == "by_grams":
                g = Decimal(str(request.data.get("grams", "0")))
                b = breakdown_from_grams(g, rate)
            elif mode == "by_total_inr":
                total = Decimal(str(request.data.get("total_inr", "0")))
                b = breakdown_from_total_inr(total, rate)
            else:
                return Response(
                    {"detail": "mode must be by_grams or by_total_inr."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception:
            return Response(
                {"detail": "Invalid amount."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        err = validate_minimums(b)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)

        note = (request.data.get("customer_note") or "").strip()[:255]

        if pay == FractionalGoldPurchase.PAY_UPI:
            initial_status = FractionalGoldPurchase.PENDING_PAYMENT
        else:
            initial_status = FractionalGoldPurchase.AWAITING_COUNTER

        p = FractionalGoldPurchase.objects.create(
            customer=user,
            jeweller=jeweller,
            metal_rate_inr_per_gram=rate,
            grams=b["grams"],
            gold_value_inr_pre_gst=b["gold_value_inr_pre_gst"],
            gst_percent=GST_PERCENT,
            gst_inr=b["gst_inr"],
            total_inr=b["total_inr"],
            payment_method=pay,
            status=initial_status,
            customer_note=note,
        )
        return Response(_ser_purchase(p), status=status.HTTP_201_CREATED)


class FractionalOrderConfirmUpiView(APIView):
    """Customer confirms UPI payment manually; credits gold immediately (no PSP webhook yet)."""

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
                    status=FractionalGoldPurchase.PENDING_PAYMENT,
                )
                _credit_customer_gold(purchase.customer, purchase.grams)
                purchase.status = FractionalGoldPurchase.COMPLETED
                purchase.jeweller_verified_at = timezone.now()
                purchase.save(
                    update_fields=["status", "jeweller_verified_at", "updated_at"]
                )
        except FractionalGoldPurchase.DoesNotExist:
            return Response(
                {
                    "detail": "Order not found or not awaiting UPI payment confirmation.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_ser_purchase(purchase))


class JewellerFractionalPendingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        qs = FractionalGoldPurchase.objects.filter(
            jeweller=request.user,
            status=FractionalGoldPurchase.AWAITING_COUNTER,
        ).select_related("customer")[:100]
        out = []
        for p in qs:
            row = _ser_purchase(p)
            row["customer"] = {
                "email": p.customer.email,
                "name": f"{p.customer.first_name} {p.customer.last_name}".strip(),
            }
            out.append(row)
        return Response({"results": out})


class JewellerFractionalVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            with transaction.atomic():
                purchase = FractionalGoldPurchase.objects.select_for_update().get(
                    pk=pk,
                    jeweller=request.user,
                    status=FractionalGoldPurchase.AWAITING_COUNTER,
                )
                _credit_customer_gold(purchase.customer, purchase.grams)
                purchase.status = FractionalGoldPurchase.COMPLETED
                purchase.jeweller_verified_at = timezone.now()
                purchase.save(
                    update_fields=["status", "jeweller_verified_at", "updated_at"]
                )
        except FractionalGoldPurchase.DoesNotExist:
            return Response(
                {"detail": "Pending counter order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_ser_purchase(purchase))
