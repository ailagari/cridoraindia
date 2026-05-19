from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .fractional_completion import apply_fractional_purchase_credit_and_liabilities
from .fractional_counter_otp import issue_counter_otp, verify_counter_otp
from .fractional_service import (
    GST_PERCENT,
    breakdown_from_grams,
    breakdown_from_total_inr,
    jeweller_metal_rate_inr_per_gram,
    validate_minimums,
)
from .models import FractionalCounterOtp, FractionalGoldPurchase
from .services.fractional_upi import (
    default_payment_expires_at,
    jeweller_upi_vpa,
    payment_note_for,
)
from apps.marketplace.models import jeweller_profile_for
from apps.marketplace.pricing import jeweller_rate_effective_updated_at

User = get_user_model()


def _ser_jeweller_brief(j: User) -> dict:
    return {
        "id": j.id,
        "business_name": j.business_name or j.email,
        "city": j.city or "",
    }


def _ser_purchase(p: FractionalGoldPurchase) -> dict:
    row = {
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
    if p.payment_method == FractionalGoldPurchase.PAY_UPI:
        row["payee_upi_vpa"] = p.payee_upi_vpa or ""
        row["payment_note"] = p.payment_note or ""
        row["payment_expires_at"] = (
            p.payment_expires_at.isoformat() if p.payment_expires_at else None
        )
        row["upi_utr"] = p.upi_utr or ""
        row["utr_submitted_at"] = (
            p.utr_submitted_at.isoformat() if p.utr_submitted_at else None
        )
    return row


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
        profile = jeweller_profile_for(jeweller)
        rate_as_of = jeweller_rate_effective_updated_at(profile).isoformat()
        return Response(
            {
                "jeweller": _ser_jeweller_brief(jeweller),
                "metal_rate_inr_per_gram": str(rate),
                "jeweller_metal_rate_last_updated_at": rate_as_of,
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
        if pay not in (
            FractionalGoldPurchase.PAY_COUNTER,
            FractionalGoldPurchase.PAY_UPI,
        ):
            return Response(
                {"detail": "payment_method must be counter or upi."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if pay == FractionalGoldPurchase.PAY_UPI and not jeweller_upi_vpa(jeweller):
            return Response(
                {
                    "detail": "This jeweller has not configured online UPI yet. Use counter or choose another jeweller.",
                },
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
            vpa = jeweller_upi_vpa(jeweller)
            assert vpa is not None
            p = FractionalGoldPurchase.objects.create(
                customer=user,
                jeweller=jeweller,
                metal_rate_inr_per_gram=rate,
                grams=b["grams"],
                gold_value_inr_pre_gst=b["gold_value_inr_pre_gst"],
                gst_percent=GST_PERCENT,
                gst_inr=b["gst_inr"],
                total_inr=b["total_inr"],
                payment_method=FractionalGoldPurchase.PAY_UPI,
                status=FractionalGoldPurchase.PENDING_PAYMENT,
                customer_note=note,
                payee_upi_vpa=vpa,
                payment_expires_at=default_payment_expires_at(),
            )
            p.payment_note = payment_note_for(p.id)
            p.save(update_fields=["payment_note", "updated_at"])
            return Response(_ser_purchase(p), status=status.HTTP_201_CREATED)

        p = FractionalGoldPurchase.objects.create(
            customer=user,
            jeweller=jeweller,
            metal_rate_inr_per_gram=rate,
            grams=b["grams"],
            gold_value_inr_pre_gst=b["gold_value_inr_pre_gst"],
            gst_percent=GST_PERCENT,
            gst_inr=b["gst_inr"],
            total_inr=b["total_inr"],
            payment_method=FractionalGoldPurchase.PAY_COUNTER,
            status=FractionalGoldPurchase.AWAITING_COUNTER,
            customer_note=note,
        )
        return Response(_ser_purchase(p), status=status.HTTP_201_CREATED)


class FractionalCounterOtpIssueView(APIView):
    """Customer generates an in-app OTP after paying at the jeweller counter."""

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
                )
                code, expires_at = issue_counter_otp(purchase)
        except FractionalGoldPurchase.DoesNotExist:
            return Response(
                {"detail": "Order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.accounts.services.user_push_notify import notify_fractional_counter_otp_issued

        notify_fractional_counter_otp_issued(purchase)
        payload = _ser_purchase(purchase)
        payload["otp"] = code
        payload["otp_expires_at"] = expires_at.isoformat()
        payload["otp_ttl_seconds"] = max(
            0, int((expires_at - timezone.now()).total_seconds())
        )
        return Response(payload)


class FractionalCounterOtpPolicyView(APIView):
    """Current counter OTP validity window (seconds); any authenticated user may read."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .services.platform_operational import fractional_counter_otp_ttl_seconds_int

        return Response({"otp_ttl_seconds": fractional_counter_otp_ttl_seconds_int()})


class FractionalOrderConfirmUpiView(APIView):
    """Legacy UPI self-confirm — disabled for new orders; retained for migration hooks."""

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
                apply_fractional_purchase_credit_and_liabilities(purchase)
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
        ).select_related("customer", "counter_otp")[:100]
        out = []
        for p in qs:
            row = _ser_purchase(p)
            row["customer"] = {
                "email": p.customer.email,
                "name": f"{p.customer.first_name} {p.customer.last_name}".strip(),
                "cridora_member_id": p.customer.cridora_member_id or "",
            }
            try:
                row["otp_expires_at"] = p.counter_otp.expires_at.isoformat()
            except FractionalCounterOtp.DoesNotExist:
                row["otp_expires_at"] = None
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
        raw_otp = request.data.get("otp") if isinstance(request.data, dict) else None
        if raw_otp is None:
            raw_otp = request.POST.get("otp")
        try:
            with transaction.atomic():
                purchase = FractionalGoldPurchase.objects.select_for_update().get(
                    pk=pk,
                    jeweller=request.user,
                    status=FractionalGoldPurchase.AWAITING_COUNTER,
                )
                ok, detail = verify_counter_otp(purchase, str(raw_otp or ""))
                if not ok:
                    return Response(
                        {"detail": detail},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                apply_fractional_purchase_credit_and_liabilities(purchase)
        except FractionalGoldPurchase.DoesNotExist:
            return Response(
                {"detail": "Pending counter order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_ser_purchase(purchase))
