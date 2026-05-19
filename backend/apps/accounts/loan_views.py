from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .gold_identity import parse_grams
from .loan_service import (
    compare_loan_offers,
    create_pending_loan_request,
    customer_vault_loan_rates,
    jeweller_accept_loan,
    jeweller_complete_loan_with_otp,
    jeweller_reject_loan,
    quote_customer_loan,
    regenerate_customer_loan_otp,
)
from .models import GoldLoanOtp, GoldLoanRequest

User = get_user_model()


def _cust_label(u: User) -> str:
    return f"{u.first_name} {u.last_name}".strip() or (u.email or "")


def _serialize_loan_customer(row: GoldLoanRequest) -> dict:
    jl = row.jeweller
    otp_row = getattr(row, "settlement_otp", None)
    exp = otp_row.expires_at.isoformat() if otp_row else None
    return {
        "id": row.id,
        "reference": f"LN-{row.id}",
        "status": row.status,
        "jeweller_id": row.jeweller_id,
        "jeweller_label": jl.business_name or jl.email or "",
        "grams": str(row.grams),
        "collateral_value_inr": str(row.collateral_value_inr_snapshot),
        "ltv_percent": str(row.ltv_percent_snapshot),
        "gross_principal_inr": str(row.gross_principal_inr_snapshot),
        "processing_fee_percent": str(row.processing_fee_percent_snapshot),
        "processing_fee_inr": str(row.processing_fee_inr_snapshot),
        "net_disbursement_inr": str(row.net_disbursement_inr_snapshot),
        "reference_metal_inr_per_gram": str(row.reference_metal_inr_per_gram_snapshot),
        "payment_method": row.payment_method,
        "otp_expires_at": exp,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


def _serialize_loan_jeweller(row: GoldLoanRequest) -> dict:
    c = row.customer
    phone = (getattr(c, "phone", None) or "").strip()
    return {
        "id": row.id,
        "reference": f"LN-{row.id}",
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
        "customer_id": row.customer_id,
        "customer_label": _cust_label(c),
        "customer_phone": phone if phone else "—",
        "grams": str(row.grams),
        "collateral_value_inr": str(row.collateral_value_inr_snapshot),
        "ltv_percent": str(row.ltv_percent_snapshot),
        "gross_principal_inr": str(row.gross_principal_inr_snapshot),
        "processing_fee_inr": str(row.processing_fee_inr_snapshot),
        "net_disbursement_inr": str(row.net_disbursement_inr_snapshot),
        "status": row.status,
        "payment_method": row.payment_method,
    }


class GoldLoanVaultRatesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        return Response({"vault_rates": customer_vault_loan_rates(user)})


class GoldLoanCompareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        grams, g_err = parse_grams(request.data.get("grams"))
        if g_err or grams is None:
            return Response({"detail": g_err or "Invalid grams."}, status=status.HTTP_400_BAD_REQUEST)
        payload, err = compare_loan_offers(user, grams=grams)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class GoldLoanQuoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            jid = int(request.data.get("jeweller_id"))
        except (TypeError, ValueError):
            return Response({"detail": "jeweller_id required."}, status=status.HTTP_400_BAD_REQUEST)
        grams, g_err = parse_grams(request.data.get("grams"))
        if g_err or grams is None:
            return Response({"detail": g_err or "Invalid grams."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            jeweller = User.objects.get(pk=jid, user_type=User.JEWELLER)
        except User.DoesNotExist:
            return Response({"detail": "Jeweller not found."}, status=status.HTTP_404_NOT_FOUND)
        payload, err = quote_customer_loan(user, jeweller, grams=grams)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class GoldLoanConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            jid = int(request.data.get("jeweller_id"))
        except (TypeError, ValueError):
            return Response({"detail": "jeweller_id required."}, status=status.HTTP_400_BAD_REQUEST)
        grams, g_err = parse_grams(request.data.get("grams"))
        if g_err or grams is None:
            return Response({"detail": g_err or "Invalid grams."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            jeweller = User.objects.get(pk=jid, user_type=User.JEWELLER)
        except User.DoesNotExist:
            return Response({"detail": "Jeweller not found."}, status=status.HTTP_404_NOT_FOUND)
        row, err, otp_plain = create_pending_loan_request(user, jeweller, grams)
        if err or row is None:
            return Response({"detail": err or "Loan request failed."}, status=status.HTTP_400_BAD_REQUEST)
        otp_row = getattr(row, "settlement_otp", None)
        expires_iso = otp_row.expires_at.isoformat() if otp_row else ""
        body: dict = {
            "detail": (
                "Loan submitted. Share the OTP with your jeweller only after you receive cash."
            ),
            "loan": _serialize_loan_customer(row),
        }
        if otp_plain:
            body["otp_code"] = otp_plain
            body["otp_expires_at"] = expires_iso
        return Response(body, status=status.HTTP_201_CREATED)


class GoldLoanOutstandingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        open_statuses = (
            GoldLoanRequest.STATUS_PENDING_JEWELLER,
            GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP,
        )
        rows = (
            GoldLoanRequest.objects.filter(customer=user, status__in=open_statuses)
            .select_related("jeweller", "settlement_otp")
            .order_by("-updated_at")[:20]
        )
        return Response({"results": [_serialize_loan_customer(r) for r in rows]})


class GoldLoanOtpRegenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        code, err = regenerate_customer_loan_otp(user, pk)
        if err or not code:
            return Response({"detail": err or "Could not regenerate OTP."}, status=status.HTTP_400_BAD_REQUEST)
        otp_obj = GoldLoanOtp.objects.filter(loan_id=pk).first()
        exp = otp_obj.expires_at.isoformat() if otp_obj else ""
        return Response({"otp_code": code, "otp_expires_at": exp})


class JewellerLoanListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        status_filter = (request.query_params.get("status") or "").strip()
        qs = GoldLoanRequest.objects.filter(jeweller=user).select_related("customer")
        if status_filter:
            qs = qs.filter(status=status_filter)
        else:
            qs = qs.filter(
                status__in=(
                    GoldLoanRequest.STATUS_PENDING_JEWELLER,
                    GoldLoanRequest.STATUS_ACCEPTED_AWAITING_OTP,
                )
            )
        qs = qs.order_by("-updated_at", "-created_at")[:100]
        return Response({"results": [_serialize_loan_jeweller(r) for r in qs]})


class JewellerLoanAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        ok, err = jeweller_accept_loan(user, pk)
        if not ok:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "detail": (
                    "Accepted. Pay the customer cash at the counter, then enter their OTP to lock collateral."
                ),
            }
        )


class JewellerLoanRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        ok, err = jeweller_reject_loan(user, pk)
        if not ok:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Loan request rejected."})


class JewellerLoanCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        otp = request.data.get("otp") or ""
        row, err = jeweller_complete_loan_with_otp(user, pk, str(otp))
        if err or row is None:
            return Response({"detail": err or "Could not complete loan."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "detail": "Loan disbursed. Vault gold locked as collateral.",
                "loan": _serialize_loan_jeweller(row),
            },
            status=status.HTTP_200_OK,
        )
