"""Unified UPI manual payment API views."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UpiFraudReport
from apps.accounts.services.upi_manual_payment.payload import (
    build_payment_payload,
    latest_submissions,
)
from apps.accounts.services.upi_manual_payment.registry import VALID_KINDS, load_entity
from apps.accounts.services.upi_manual_payment.review import (
    approve_payment,
    reject_payment,
    report_fraud,
    serialize_fraud_report,
)
from apps.accounts.services.upi_manual_payment.submit import submit_screenshot, submit_utr

User = get_user_model()


class UpiPaymentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, kind: str, pk: int):
        if kind not in VALID_KINDS:
            return Response({"detail": "Unknown payment kind."}, status=status.HTTP_404_NOT_FOUND)
        try:
            entity = load_entity(kind, pk)
        except Exception:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        payload = build_payment_payload(kind, entity)
        payload["submissions"] = latest_submissions(kind, entity)
        return Response(payload)


class UpiSubmitUtrView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, kind: str, pk: int):
        if kind not in VALID_KINDS:
            return Response({"detail": "Unknown payment kind."}, status=status.HTTP_404_NOT_FOUND)
        data = request.data if isinstance(request.data, dict) else {}
        raw_utr = str(data.get("utr") or "")
        try:
            entity = load_entity(kind, pk)
        except Exception:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        out, err = submit_utr(kind, entity, request.user, raw_utr)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(out)


class UpiSubmitProofView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, kind: str, pk: int):
        if kind not in VALID_KINDS:
            return Response({"detail": "Unknown payment kind."}, status=status.HTTP_404_NOT_FOUND)
        proof_file = request.FILES.get("proof_file") or request.FILES.get("file")
        raw_utr = str(request.data.get("utr") or "")
        try:
            entity = load_entity(kind, pk)
        except Exception:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        out, err = submit_screenshot(kind, entity, request.user, proof_file, raw_utr)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(out)


class UpiApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, kind: str, pk: int):
        if kind not in VALID_KINDS:
            return Response({"detail": "Unknown payment kind."}, status=status.HTTP_404_NOT_FOUND)
        try:
            entity = load_entity(kind, pk)
        except Exception:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        out, err = approve_payment(kind, entity, request.user)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(out)


class UpiRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, kind: str, pk: int):
        if kind not in VALID_KINDS:
            return Response({"detail": "Unknown payment kind."}, status=status.HTTP_404_NOT_FOUND)
        data = request.data if isinstance(request.data, dict) else {}
        remark = str(data.get("remark") or "")
        confirm = bool(data.get("confirm"))
        try:
            entity = load_entity(kind, pk)
        except Exception:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        out, err = reject_payment(kind, entity, request.user, remark, confirm=confirm)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(out)


class UpiReportFraudView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, kind: str, pk: int):
        if kind not in VALID_KINDS:
            return Response({"detail": "Unknown payment kind."}, status=status.HTTP_404_NOT_FOUND)
        data = request.data if isinstance(request.data, dict) else {}
        note = str(data.get("note") or "")
        try:
            entity = load_entity(kind, pk)
        except Exception:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        out, err = report_fraud(kind, entity, request.user, note)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(out)


class AdminUpiFraudReportsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.ADMIN:
            return Response({"detail": "Admins only."}, status=status.HTTP_403_FORBIDDEN)
        status_filter = request.query_params.get("status", "open")
        qs = UpiFraudReport.objects.select_related("reported_by", "content_type").order_by(
            "-created_at"
        )
        if status_filter:
            qs = qs.filter(status=status_filter)
        rows = [serialize_fraud_report(r) for r in qs[:200]]
        return Response({"results": rows})


class AdminUpiFraudReportReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.ADMIN:
            return Response({"detail": "Admins only."}, status=status.HTTP_403_FORBIDDEN)
        from django.utils import timezone

        try:
            row = UpiFraudReport.objects.get(pk=pk)
        except UpiFraudReport.DoesNotExist:
            return Response({"detail": "Report not found."}, status=status.HTTP_404_NOT_FOUND)
        row.status = UpiFraudReport.STATUS_REVIEWED
        row.reviewed_by = request.user
        row.reviewed_at = timezone.now()
        row.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        return Response(serialize_fraud_report(row))
