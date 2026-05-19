from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .gold_identity import parse_grams
from .loan_service import compare_loan_offers, create_pending_loan_request, quote_customer_loan
from .models import GoldLoanRequest

User = get_user_model()


def _cust_label(u: User) -> str:
    return f"{u.first_name} {u.last_name}".strip() or (u.email or "")


def _serialize_loan_customer(row: GoldLoanRequest) -> dict:
    jl = row.jeweller
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
    }


class GoldLoanCompareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        grams = parse_grams(request.data.get("grams"))
        if grams is None:
            return Response({"detail": "Invalid grams."}, status=status.HTTP_400_BAD_REQUEST)
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
        grams = parse_grams(request.data.get("grams"))
        if grams is None:
            return Response({"detail": "Invalid grams."}, status=status.HTTP_400_BAD_REQUEST)
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
        grams = parse_grams(request.data.get("grams"))
        if grams is None:
            return Response({"detail": "Invalid grams."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            jeweller = User.objects.get(pk=jid, user_type=User.JEWELLER)
        except User.DoesNotExist:
            return Response({"detail": "Jeweller not found."}, status=status.HTTP_404_NOT_FOUND)
        row, err = create_pending_loan_request(user, jeweller, grams)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_serialize_loan_customer(row), status=status.HTTP_201_CREATED)


class GoldLoanOutstandingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        open_statuses = (
            GoldLoanRequest.STATUS_PENDING_JEWELLER,
            GoldLoanRequest.STATUS_APPROVED,
        )
        rows = GoldLoanRequest.objects.filter(
            customer=user, status__in=open_statuses
        ).select_related("jeweller")
        return Response([_serialize_loan_customer(r) for r in rows])


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
                    GoldLoanRequest.STATUS_APPROVED,
                )
            )
        return Response([_serialize_loan_jeweller(r) for r in qs[:100]])


class JewellerLoanAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            row = GoldLoanRequest.objects.get(pk=pk, jeweller=user)
        except GoldLoanRequest.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if row.status != GoldLoanRequest.STATUS_PENDING_JEWELLER:
            return Response({"detail": "Request is not pending."}, status=status.HTTP_400_BAD_REQUEST)
        row.status = GoldLoanRequest.STATUS_APPROVED
        row.save(update_fields=["status", "updated_at"])
        return Response(_serialize_loan_jeweller(row))


class JewellerLoanRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            row = GoldLoanRequest.objects.get(pk=pk, jeweller=user)
        except GoldLoanRequest.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if row.status != GoldLoanRequest.STATUS_PENDING_JEWELLER:
            return Response({"detail": "Request is not pending."}, status=status.HTTP_400_BAD_REQUEST)
        row.status = GoldLoanRequest.STATUS_REJECTED
        row.save(update_fields=["status", "updated_at"])
        return Response(_serialize_loan_jeweller(row))


class JewellerLoanDisburseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            row = GoldLoanRequest.objects.get(pk=pk, jeweller=user)
        except GoldLoanRequest.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if row.status != GoldLoanRequest.STATUS_APPROVED:
            return Response(
                {"detail": "Loan must be approved before disbursement."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        row.status = GoldLoanRequest.STATUS_DISBURSED
        row.save(update_fields=["status", "updated_at"])
        return Response(_serialize_loan_jeweller(row))
