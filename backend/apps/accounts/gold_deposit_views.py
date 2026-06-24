"""REST API: physical gold deposit intakes (jeweller records → customer OTP → vault credit)."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .fractional_service import MIN_GRAMS, jeweller_metal_rate_inr_per_gram
from .gold_deposit_completion import apply_gold_deposit_credit_and_liabilities
from .gold_deposit_counter_otp import (
    issue_gold_deposit_counter_otp,
    verify_gold_deposit_counter_otp,
)
from .models import GoldDepositCounterOtp, GoldDepositIntake
from .services.kyc_policy import require_customer_kyc
from .services.platform_operational import fractional_counter_otp_ttl_seconds_int

User = get_user_model()


def _ser_jeweller_brief(j: User) -> dict:
    return {
        "id": j.id,
        "business_name": j.business_name or j.email,
        "city": j.city or "",
    }


def _ser_intake(d: GoldDepositIntake, *, include_customer: bool) -> dict:
    row = {
        "id": d.id,
        "reference": f"GD-{d.id}",
        "grams": str(d.grams),
        "purity_karat": d.purity_karat,
        "reference_metal_inr_per_gram": str(d.reference_metal_inr_per_gram),
        "estimated_value_inr": str(d.estimated_value_inr),
        "jeweller_note": d.jeweller_note,
        "status": d.status,
        "created_at": d.created_at.isoformat(),
        "completed_at": d.completed_at.isoformat() if d.completed_at else None,
        "jeweller": _ser_jeweller_brief(d.jeweller),
    }
    if include_customer:
        c = d.customer
        row["customer"] = {
            "id": c.id,
            "email": c.email,
            "name": f"{c.first_name} {c.last_name}".strip(),
            "cridora_member_id": c.cridora_member_id or "",
        }
    return row


class JewellerGoldDepositIntakeCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        if request.user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {"detail": "Complete KYB before recording deposits."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            customer_id = int(request.data.get("customer_id"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "customer_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        customer = User.objects.filter(
            pk=customer_id,
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        ).first()
        if not customer:
            return Response(
                {"detail": "Verified customer not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            grams = Decimal(str(request.data.get("grams", "0"))).quantize(Decimal("0.000001"))
        except Exception:
            return Response({"detail": "Invalid grams."}, status=status.HTTP_400_BAD_REQUEST)
        if grams < MIN_GRAMS:
            return Response(
                {"detail": f"Minimum gold quantity is {MIN_GRAMS} g."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        purity = (request.data.get("purity_karat") or "22").strip()[:32] or "22"
        note = (request.data.get("jeweller_note") or "").strip()[:500]
        rate = jeweller_metal_rate_inr_per_gram(request.user)
        est = (grams * rate).quantize(Decimal("0.01"))
        intake = GoldDepositIntake.objects.create(
            customer=customer,
            jeweller=request.user,
            grams=grams,
            purity_karat=purity,
            reference_metal_inr_per_gram=rate,
            estimated_value_inr=est,
            jeweller_note=note,
            status=GoldDepositIntake.AWAITING_CUSTOMER_OTP,
        )
        from apps.accounts.services.user_push_notify import notify_gold_deposit_intake_created

        notify_gold_deposit_intake_created(intake)
        return Response(_ser_intake(intake, include_customer=True), status=status.HTTP_201_CREATED)

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        qs = (
            GoldDepositIntake.objects.filter(jeweller=request.user)
            .select_related("customer", "counter_otp")
            .order_by("-created_at")[:100]
        )
        out = []
        for d in qs:
            row = _ser_intake(d, include_customer=True)
            if d.status == GoldDepositIntake.AWAITING_CUSTOMER_OTP:
                try:
                    row["otp_expires_at"] = d.counter_otp.expires_at.isoformat()
                except GoldDepositCounterOtp.DoesNotExist:
                    row["otp_expires_at"] = None
            else:
                row["otp_expires_at"] = None
            out.append(row)
        return Response({"results": out})


class JewellerGoldDepositPendingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        qs = GoldDepositIntake.objects.filter(
            jeweller=request.user,
            status=GoldDepositIntake.AWAITING_CUSTOMER_OTP,
        ).select_related("customer", "counter_otp")[:100]
        out = []
        for d in qs:
            row = _ser_intake(d, include_customer=True)
            try:
                row["otp_expires_at"] = d.counter_otp.expires_at.isoformat()
            except GoldDepositCounterOtp.DoesNotExist:
                row["otp_expires_at"] = None
            out.append(row)
        return Response({"results": out})


class JewellerGoldDepositVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        raw_otp = request.data.get("otp") if isinstance(request.data, dict) else None
        if raw_otp is None:
            raw_otp = request.POST.get("otp")
        try:
            with transaction.atomic():
                intake = GoldDepositIntake.objects.select_for_update().get(
                    pk=pk,
                    jeweller=request.user,
                    status=GoldDepositIntake.AWAITING_CUSTOMER_OTP,
                )
                ok, detail = verify_gold_deposit_counter_otp(intake, str(raw_otp or ""))
                if not ok:
                    return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)
                apply_gold_deposit_credit_and_liabilities(intake)
        except GoldDepositIntake.DoesNotExist:
            return Response(
                {"detail": "Pending deposit intake not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        intake.refresh_from_db()
        return Response(_ser_intake(intake, include_customer=True))


class CustomerGoldDepositIntakesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        qs = GoldDepositIntake.objects.filter(customer=request.user).select_related(
            "jeweller", "counter_otp"
        )[:50]
        out = []
        for d in qs:
            row = _ser_intake(d, include_customer=False)
            if d.status == GoldDepositIntake.AWAITING_CUSTOMER_OTP:
                try:
                    row["otp_expires_at"] = d.counter_otp.expires_at.isoformat()
                except GoldDepositCounterOtp.DoesNotExist:
                    row["otp_expires_at"] = None
            else:
                row["otp_expires_at"] = None
            out.append(row)
        return Response({"results": out})


class CustomerGoldDepositCounterOtpIssueView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        blocked = require_customer_kyc(request.user, "Complete KYC before confirming a deposit.")
        if blocked:
            return blocked
        try:
            with transaction.atomic():
                intake = GoldDepositIntake.objects.select_for_update().get(
                    pk=pk,
                    customer=request.user,
                    status=GoldDepositIntake.AWAITING_CUSTOMER_OTP,
                )
                code, expires_at = issue_gold_deposit_counter_otp(intake)
        except GoldDepositIntake.DoesNotExist:
            return Response({"detail": "Deposit intake not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        from apps.accounts.services.user_push_notify import notify_gold_deposit_counter_otp_issued

        notify_gold_deposit_counter_otp_issued(intake)
        payload = _ser_intake(intake, include_customer=False)
        payload["otp"] = code
        payload["otp_expires_at"] = expires_at.isoformat()
        payload["otp_ttl_seconds"] = max(
            0,
            int((expires_at - timezone.now()).total_seconds()),
        )
        payload["otp_policy_seconds"] = fractional_counter_otp_ttl_seconds_int()
        return Response(payload)
