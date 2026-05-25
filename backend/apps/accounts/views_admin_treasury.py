"""Admin treasury ledger, settlement summary, payments, and CSV export."""

from __future__ import annotations

from datetime import date

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PlatformSettlementPayment
from apps.accounts.services.admin_access import user_is_platform_admin
from apps.accounts.services.personal_holdings import validate_document_upload
from apps.accounts.services.platform_treasury_ledger import (
    platform_settlement_summary_payload,
    platform_treasury_ledger_payload,
    treasury_report_csv,
)
from apps.accounts.services.settlement_payment_service import (
    confirm_settlement_payment,
    reject_settlement_payment,
    serialize_settlement_payment,
)
from apps.accounts.services.settlement_treasury_service import (
    initiate_admin_payment,
    initiate_jeweller_payment,
    jeweller_settlement_summary_payload,
    serialize_payment_initiate_response,
)
from apps.accounts.settlement_otp import issue_settlement_otp, verify_settlement_otp

User = get_user_model()


def _validate_receipt_upload(uploaded) -> str | None:
    max_bytes = int(getattr(settings, "PERSONAL_HOLDING_MAX_UPLOAD_BYTES", 8 * 1024 * 1024))
    return validate_document_upload(
        filename=getattr(uploaded, "name", "") or "",
        size_bytes=int(getattr(uploaded, "size", 0) or 0),
        max_bytes=max_bytes,
    )


def _require_admin(request):
    if not user_is_platform_admin(request.user):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _parse_date_param(raw: str | None) -> date | None:
    if not raw:
        return None
    return parse_date(raw.strip())


def _load_settlement_payment(pk: int) -> PlatformSettlementPayment | None:
    try:
        return PlatformSettlementPayment.objects.select_related("jeweller").get(pk=pk)
    except PlatformSettlementPayment.DoesNotExist:
        return None


class AdminTreasuryLedgerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied
        feature = (request.query_params.get("feature") or "").strip()
        jeweller_id = request.query_params.get("jeweller_id")
        jid = int(jeweller_id) if jeweller_id and jeweller_id.isdigit() else None
        from_date = _parse_date_param(request.query_params.get("from"))
        to_date = _parse_date_param(request.query_params.get("to"))
        try:
            limit = int(request.query_params.get("limit") or 50)
        except ValueError:
            limit = 50
        try:
            offset = int(request.query_params.get("offset") or 0)
        except ValueError:
            offset = 0
        payload = platform_treasury_ledger_payload(
            feature=feature,
            jeweller_id=jid,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            offset=offset,
        )
        return Response(payload)


class AdminTreasurySettlementSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied
        return Response(platform_settlement_summary_payload())


class AdminTreasuryPaymentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied
        qs = PlatformSettlementPayment.objects.select_related("jeweller").order_by("-created_at")[:200]
        return Response({"results": [serialize_settlement_payment(p) for p in qs]})

    def post(self, request):
        denied = _require_admin(request)
        if denied:
            return denied
        data = request.data if isinstance(request.data, dict) else {}
        payment, err = initiate_admin_payment(
            request.user,
            jeweller_id=data.get("jeweller_id"),
            amount_inr=data.get("amount_inr"),
            payment_method=data.get("payment_method"),
            direction=(data.get("direction") or PlatformSettlementPayment.DIR_PLATFORM_TO_JEWELLER).strip(),
        )
        if err:
            code = status.HTTP_404_NOT_FOUND if err == "Jeweller not found." else status.HTTP_400_BAD_REQUEST
            return Response({"detail": err}, status=code)
        assert payment is not None
        return Response(serialize_payment_initiate_response(payment), status=status.HTTP_201_CREATED)


class AdminTreasuryPaymentInitiateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        denied = _require_admin(request)
        if denied:
            return denied
        data = request.data if isinstance(request.data, dict) else {}
        payment, err = initiate_admin_payment(
            request.user,
            jeweller_id=data.get("jeweller_id"),
            amount_inr=data.get("amount_inr"),
            payment_method=data.get("payment_method"),
            direction=(data.get("direction") or PlatformSettlementPayment.DIR_PLATFORM_TO_JEWELLER).strip(),
        )
        if err:
            code = status.HTTP_404_NOT_FOUND if err == "Jeweller not found." else status.HTTP_400_BAD_REQUEST
            return Response({"detail": err}, status=code)
        assert payment is not None
        return Response(serialize_payment_initiate_response(payment), status=status.HTTP_201_CREATED)


class AdminTreasuryPaymentConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        denied = _require_admin(request)
        if denied:
            return denied
        payment = _load_settlement_payment(pk)
        if not payment:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        if payment.status not in (
            PlatformSettlementPayment.STATUS_SUBMITTED,
            PlatformSettlementPayment.STATUS_PENDING_PROOF,
        ):
            return Response({"detail": "Payment cannot be confirmed."}, status=status.HTTP_400_BAD_REQUEST)
        confirm_settlement_payment(payment, request.user)
        payment.refresh_from_db()
        return Response(serialize_settlement_payment(payment))


class AdminTreasuryPaymentRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        denied = _require_admin(request)
        if denied:
            return denied
        payment = _load_settlement_payment(pk)
        if not payment:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        reason = ""
        if isinstance(request.data, dict):
            reason = str(request.data.get("reason") or "")
        reject_settlement_payment(payment, request.user, reason)
        payment.refresh_from_db()
        return Response(serialize_settlement_payment(payment))


class SettlementPaymentOtpIssueView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        payment = _load_settlement_payment(pk)
        if not payment:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        code, expires_at, err = issue_settlement_otp(payment, request.user)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        payment.refresh_from_db()
        payload = serialize_settlement_payment(payment)
        payload["otp"] = code
        payload["expires_at"] = expires_at.isoformat() if expires_at else None
        return Response(payload)


class SettlementPaymentOtpVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        payment = _load_settlement_payment(pk)
        if not payment:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        raw_otp = ""
        if isinstance(request.data, dict):
            raw_otp = str(request.data.get("otp") or "")
        ok, err = verify_settlement_otp(payment, request.user, raw_otp)
        if not ok:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        payment.refresh_from_db()
        return Response(serialize_settlement_payment(payment))


class AdminTreasuryReportExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied
        group_by = (request.query_params.get("group_by") or "").strip()
        if group_by not in ("jeweller", "customer", "feature", "day", "month"):
            return Response({"detail": "group_by required."}, status=status.HTTP_400_BAD_REQUEST)
        from_date = _parse_date_param(request.query_params.get("from"))
        to_date = _parse_date_param(request.query_params.get("to"))
        output = (request.query_params.get("output") or request.query_params.get("format") or "csv").strip().lower()
        if output != "csv":
            return Response({"detail": "Only output=csv supported."}, status=status.HTTP_400_BAD_REQUEST)
        csv_body = treasury_report_csv(group_by=group_by, from_date=from_date, to_date=to_date)
        return Response(csv_body, content_type="text/csv", headers={
            "Content-Disposition": f'attachment; filename="treasury-{group_by}.csv"',
        })


class JewellerTreasurySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        return Response(jeweller_settlement_summary_payload(request.user))


class JewellerTreasuryLedgerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        from apps.accounts.services.settlement_treasury_service import jeweller_settlement_ledger_payload

        return Response(jeweller_settlement_ledger_payload(request.user))


class JewellerTreasuryPaymentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        qs = PlatformSettlementPayment.objects.filter(jeweller=request.user).order_by("-created_at")[:100]
        return Response({"results": [serialize_settlement_payment(p) for p in qs]})

    def post(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        data = request.data if isinstance(request.data, dict) else {}
        payment, err = initiate_jeweller_payment(
            request.user,
            amount_inr=data.get("amount_inr"),
            payment_method=data.get("payment_method") or PlatformSettlementPayment.PAY_UPI,
        )
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        assert payment is not None
        return Response(serialize_payment_initiate_response(payment), status=status.HTTP_201_CREATED)


class JewellerTreasuryPaymentInitiateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        data = request.data if isinstance(request.data, dict) else {}
        payment, err = initiate_jeweller_payment(
            request.user,
            amount_inr=data.get("amount_inr"),
            payment_method=data.get("payment_method") or PlatformSettlementPayment.PAY_UPI,
        )
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        assert payment is not None
        return Response(serialize_payment_initiate_response(payment), status=status.HTTP_201_CREATED)
