from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .gold_identity import parse_cash_inr, parse_grams
from .models import GoldSellbackOtp, GoldSellbackRequest
from .sellback_service import (
    create_pending_sellback_with_otp,
    jeweller_accept_sellback,
    jeweller_complete_sellback_with_otp,
    jeweller_reject_sellback,
    quote_customer_sellback,
    regenerate_customer_sellback_otp,
)
from .views_gold import _wallet_payload

User = get_user_model()


def _cust_label(u: User) -> str:
    return f"{u.first_name} {u.last_name}".strip() or (u.email or "")


def _serialize_sellback_jeweller(row: GoldSellbackRequest) -> dict:
    c = row.customer
    phone = (getattr(c, "phone", None) or "").strip()
    return {
        "id": row.id,
        "reference": f"SB-{row.id}",
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
        "customer_id": row.customer_id,
        "customer_label": _cust_label(c),
        "customer_phone": phone if phone else "—",
        "grams": str(row.grams),
        "reference_metal_inr_per_gram_snapshot": str(row.reference_metal_inr_per_gram_snapshot),
        "buyback_inr_per_gram_snapshot": str(row.buyback_inr_per_gram_snapshot),
        "cash_estimate_inr": str(row.cash_estimate_inr),
        "payment_method": row.payment_method,
        "payout_upi_vpa": row.payout_upi_vpa or "",
        "status": row.status,
        "upi_utr": row.upi_utr or "",
        "utr_submitted_at": row.utr_submitted_at.isoformat() if row.utr_submitted_at else None,
    }


def _serialize_customer_outstanding(row: GoldSellbackRequest) -> dict:
    otp_row = getattr(row, "settlement_otp", None)
    exp = otp_row.expires_at.isoformat() if otp_row else None
    jl = row.jeweller
    return {
        "id": row.id,
        "reference": f"SB-{row.id}",
        "status": row.status,
        "payment_method": row.payment_method,
        "payout_upi_vpa": row.payout_upi_vpa or "",
        "jeweller_label": jl.business_name or jl.email or "",
        "grams": str(row.grams),
        "cash_estimate_inr": str(row.cash_estimate_inr),
        "buyback_inr_per_gram": str(row.buyback_inr_per_gram_snapshot),
        "otp_expires_at": exp,
        "upi_utr": row.upi_utr or "",
        "utr_submitted_at": row.utr_submitted_at.isoformat() if row.utr_submitted_at else None,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


class GoldSellbackQuoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            jid = int(request.data.get("jeweller_id"))
        except (TypeError, ValueError):
            return Response({"detail": "jeweller_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        jeweller = User.objects.filter(pk=jid, user_type=User.JEWELLER).first()
        if not jeweller:
            return Response({"detail": "Jeweller not found."}, status=status.HTTP_400_BAD_REQUEST)

        raw_g = request.data.get("grams")
        raw_cash = request.data.get("cash_inr")
        has_g = raw_g not in (None, "")
        has_c = raw_cash not in (None, "")

        if has_g == has_c:
            return Response(
                {"detail": "Send exactly one of grams or cash_inr."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if has_g:
            grams, err = parse_grams(raw_g)
            if err:
                return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
            payload, qerr = quote_customer_sellback(user, jeweller, grams=grams)
        else:
            cash_inr, err = parse_cash_inr(raw_cash)
            if err:
                return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
            payload, qerr = quote_customer_sellback(user, jeweller, cash_inr=cash_inr)

        if qerr:
            return Response({"detail": qerr}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class GoldSellbackConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            jid = int(request.data.get("jeweller_id"))
        except (TypeError, ValueError):
            return Response({"detail": "jeweller_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        grams, err = parse_grams(request.data.get("grams"))
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)

        payment_method = str(request.data.get("payment_method") or GoldSellbackRequest.PAY_CASH).strip().lower()
        payout_upi_vpa = str(request.data.get("payout_upi_vpa") or "").strip()

        jeweller = User.objects.filter(pk=jid, user_type=User.JEWELLER).first()
        if not jeweller:
            return Response({"detail": "Jeweller not found."}, status=status.HTTP_400_BAD_REQUEST)

        row, ex_err, otp_plain = create_pending_sellback_with_otp(
            user,
            jeweller,
            grams,
            payment_method=payment_method,
            payout_upi_vpa=payout_upi_vpa,
        )
        if ex_err or row is None:
            return Response(
                {"detail": ex_err or "Sellback request failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp_row = getattr(row, "settlement_otp", None)
        expires_iso = otp_row.expires_at.isoformat() if otp_row else ""

        if hasattr(user, "gold_balance"):
            user.gold_balance.refresh_from_db()

        detail = (
            "Sellback submitted. Your jeweller will pay you via UPI after accepting."
            if row.payment_method == GoldSellbackRequest.PAY_UPI
            else "Sellback submitted. Share the OTP with your jeweller only after you receive cash."
        )

        body: dict = {
            "detail": detail,
            "sellback": {
                "id": row.id,
                "reference": f"SB-{row.id}",
                "grams": str(row.grams),
                "cash_estimate_inr": str(row.cash_estimate_inr),
                "buyback_inr_per_gram": str(row.buyback_inr_per_gram_snapshot),
                "status": row.status,
                "payment_method": row.payment_method,
                "payout_upi_vpa": row.payout_upi_vpa or "",
            },
            "wallet": _wallet_payload(user),
        }
        if otp_plain:
            body["otp_code"] = otp_plain
            body["otp_expires_at"] = expires_iso

        return Response(body, status=status.HTTP_201_CREATED)


class GoldSellbackOutstandingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        qs = (
            GoldSellbackRequest.objects.filter(
                customer=user,
                status__in=(
                    GoldSellbackRequest.STATUS_PENDING_JEWELLER,
                    GoldSellbackRequest.STATUS_ACCEPTED_AWAITING_OTP,
                    GoldSellbackRequest.STATUS_AWAITING_UTR_VERIFY,
                ),
            )
            .select_related("jeweller", "settlement_otp")
            .order_by("-updated_at")[:20]
        )
        return Response({"results": [_serialize_customer_outstanding(r) for r in qs]})


class GoldSellbackOtpRegenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        code, err = regenerate_customer_sellback_otp(user, pk)
        if err or not code:
            return Response({"detail": err or "Could not regenerate OTP."}, status=status.HTTP_400_BAD_REQUEST)
        otp_obj = GoldSellbackOtp.objects.filter(sellback_id=pk).first()
        exp = otp_obj.expires_at.isoformat() if otp_obj else ""
        return Response({"otp_code": code, "otp_expires_at": exp})


class JewellerSellbackListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        qs = (
            GoldSellbackRequest.objects.filter(jeweller=user)
            .select_related("customer")
            .order_by("-updated_at", "-created_at")[:100]
        )
        return Response({"results": [_serialize_sellback_jeweller(r) for r in qs]})


class JewellerSellbackAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        ok, err = jeweller_accept_sellback(user, pk)
        if not ok:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        row = GoldSellbackRequest.objects.filter(pk=pk, jeweller=user).first()
        if row and row.payment_method == GoldSellbackRequest.PAY_UPI:
            msg = "Accepted. Pay the customer via UPI, then submit the UTR from your receipt."
        else:
            msg = "Accepted. Pay the customer offline, then enter their OTP to debit vault gold."
        return Response({"detail": msg})


class JewellerSellbackRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        ok, err = jeweller_reject_sellback(user, pk)
        if not ok:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Sellback request rejected."})


class JewellerSellbackCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        otp = request.data.get("otp") or ""
        row, err = jeweller_complete_sellback_with_otp(user, pk, str(otp))
        if err or row is None:
            return Response({"detail": err or "Could not complete sellback."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "detail": "Sellback settled. Vault grams debited.",
                "sellback": _serialize_sellback_jeweller(row),
            },
            status=status.HTTP_200_OK,
        )
