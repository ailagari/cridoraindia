"""UPI loan repayment reconciliation views."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from decimal import InvalidOperation

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .loan_service import _serialize_repayment_request
from .models import GoldLoanRepaymentRequest
from .services.fractional_upi import (
    build_loan_repayment_upi_uri,
    jeweller_upi_payee_name,
    utr_already_used,
)
from .services.payment_reconciliation.loan_engine import run_loan_repayment_reconciliation
from .services.payment_reconciliation.signals import (
    capture_loan_sms_signal,
    capture_loan_user_input_signal,
    loan_payment_note_for,
)

User = get_user_model()

LOAN_RECON_STATUSES = (
    GoldLoanRepaymentRequest.STATUS_PENDING_PAYMENT,
    GoldLoanRepaymentRequest.STATUS_SIGNAL_RECEIVED,
    GoldLoanRepaymentRequest.STATUS_PENDING_REVIEW,
    GoldLoanRepaymentRequest.STATUS_NEEDS_MANUAL_VERIFICATION,
)


def _parse_received_at(raw: str) -> datetime:
    if raw:
        parsed = parse_datetime(raw)
        if parsed is not None:
            if timezone.is_naive(parsed):
                return timezone.make_aware(parsed)
            return parsed
    return timezone.now()


def _is_loan_payment_expired(req: GoldLoanRepaymentRequest) -> bool:
    if req.payment_expires_at is None:
        return False
    return timezone.now() > req.payment_expires_at


class LoanRepaymentPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        req = (
            GoldLoanRepaymentRequest.objects.filter(
                pk=pk,
                loan__customer=request.user,
                payment_method=GoldLoanRepaymentRequest.PAY_UPI,
            )
            .select_related("loan__jeweller")
            .first()
        )
        if not req:
            return Response({"detail": "UPI repayment not found."}, status=status.HTTP_404_NOT_FOUND)
        jeweller = req.loan.jeweller
        vpa = req.payee_upi_vpa or ""
        payload = _serialize_repayment_request(req)
        payload["order_reference"] = req.order_reference
        payload["payment"] = {
            "reference": req.order_reference,
            "payee_vpa": vpa,
            "payee_name": jeweller_upi_payee_name(jeweller),
            "amount_inr": str(req.amount_inr),
            "payment_note": req.payment_note or loan_payment_note_for(req.pk),
            "upi_uri": build_loan_repayment_upi_uri(
                vpa=vpa,
                payee_name=jeweller_upi_payee_name(jeweller),
                amount_inr=req.amount_inr,
                repayment_id=req.pk,
            ),
            "payment_expires_at": req.payment_expires_at.isoformat() if req.payment_expires_at else None,
            "expired": _is_loan_payment_expired(req),
        }
        return Response(payload)


class LoanRepaymentSubmitUtrView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        raw_utr = str((request.data or {}).get("utr") or "")
        try:
            with transaction.atomic():
                req = GoldLoanRepaymentRequest.objects.select_for_update().get(
                    pk=pk,
                    loan__customer=request.user,
                    payment_method=GoldLoanRepaymentRequest.PAY_UPI,
                )
                if req.status not in LOAN_RECON_STATUSES:
                    return Response(
                        {"detail": "Repayment is not awaiting payment."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if _is_loan_payment_expired(req):
                    return Response(
                        {"detail": "Payment window expired."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                utr = raw_utr.strip()
                if utr:
                    from .services.fractional_upi import normalize_utr

                    utr_norm = normalize_utr(utr)
                    if utr_norm and utr_already_used(utr_norm, exclude_repayment_id=req.pk):
                        return Response(
                            {"detail": "This UPI reference is already linked to another payment."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                capture_loan_user_input_signal(req, utr=raw_utr)
                run_loan_repayment_reconciliation(req)
        except GoldLoanRepaymentRequest.DoesNotExist:
            return Response({"detail": "Repayment not found."}, status=status.HTTP_404_NOT_FOUND)
        body = _serialize_repayment_request(req)
        body["order_reference"] = req.order_reference
        body["reconciliation_score"] = req.reconciliation_score
        return Response(body)


class LoanRepaymentPaymentAckView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            with transaction.atomic():
                req = GoldLoanRepaymentRequest.objects.select_for_update().get(
                    pk=pk,
                    loan__customer=request.user,
                    payment_method=GoldLoanRepaymentRequest.PAY_UPI,
                )
                if req.status not in LOAN_RECON_STATUSES:
                    return Response(
                        {"detail": "Repayment is not awaiting payment."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                capture_loan_user_input_signal(req, utr="")
                run_loan_repayment_reconciliation(req)
        except GoldLoanRepaymentRequest.DoesNotExist:
            return Response({"detail": "Repayment not found."}, status=status.HTTP_404_NOT_FOUND)
        body = _serialize_repayment_request(req)
        body["reconciliation_score"] = req.reconciliation_score
        return Response(body)


class LoanRepaymentPaymentSmsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        sms_text = str((request.data or {}).get("sms_text") or "").strip()
        if not sms_text:
            return Response({"detail": "sms_text is required."}, status=status.HTTP_400_BAD_REQUEST)
        received_at = _parse_received_at(str((request.data or {}).get("received_at") or ""))
        try:
            with transaction.atomic():
                req = GoldLoanRepaymentRequest.objects.select_for_update().get(
                    pk=pk,
                    loan__customer=request.user,
                    payment_method=GoldLoanRepaymentRequest.PAY_UPI,
                )
                if req.status not in LOAN_RECON_STATUSES:
                    return Response(
                        {"detail": "Repayment is not awaiting payment."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                sig = capture_loan_sms_signal(req, sms_text, received_at=received_at)
                if sig is None:
                    return Response(
                        {"detail": "Could not parse payment details from SMS."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if sig.utr and utr_already_used(sig.utr, exclude_repayment_id=req.pk):
                    return Response(
                        {"detail": "This UPI reference is already linked to another payment."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                run_loan_repayment_reconciliation(req)
        except GoldLoanRepaymentRequest.DoesNotExist:
            return Response({"detail": "Repayment not found."}, status=status.HTTP_404_NOT_FOUND)
        body = _serialize_repayment_request(req)
        body["reconciliation_score"] = req.reconciliation_score
        return Response(body)
