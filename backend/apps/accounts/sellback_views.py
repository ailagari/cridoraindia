from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .gold_identity import parse_grams
from .models import GoldSellbackRequest
from .sellback_service import execute_customer_sellback, quote_customer_sellback
from .views_gold import _wallet_payload

User = get_user_model()


def _serialize_sellback_jeweller(row: GoldSellbackRequest) -> dict:
    c = row.customer
    label = f"{c.first_name} {c.last_name}".strip() or (c.email or "")
    return {
        "id": row.id,
        "reference": f"SB-{row.id}",
        "created_at": row.created_at.isoformat(),
        "customer_id": row.customer_id,
        "customer_label": label,
        "grams": str(row.grams),
        "reference_metal_inr_per_gram_snapshot": str(row.reference_metal_inr_per_gram_snapshot),
        "buyback_inr_per_gram_snapshot": str(row.buyback_inr_per_gram_snapshot),
        "cash_estimate_inr": str(row.cash_estimate_inr),
        "status": row.status,
    }


class GoldSellbackQuoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Customers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            jid = int(request.data.get("jeweller_id"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "jeweller_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        grams, err = parse_grams(request.data.get("grams"))
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        jeweller = User.objects.filter(pk=jid, user_type=User.JEWELLER).first()
        if not jeweller:
            return Response(
                {"detail": "Jeweller not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        payload, qerr = quote_customer_sellback(user, jeweller, grams)
        if qerr:
            return Response({"detail": qerr}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class GoldSellbackConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Customers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            jid = int(request.data.get("jeweller_id"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "jeweller_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        grams, err = parse_grams(request.data.get("grams"))
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        jeweller = User.objects.filter(pk=jid, user_type=User.JEWELLER).first()
        if not jeweller:
            return Response(
                {"detail": "Jeweller not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        row, ex_err = execute_customer_sellback(user, jeweller, grams)
        if ex_err or row is None:
            return Response(
                {"detail": ex_err or "Sellback failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if hasattr(user, "gold_balance"):
            user.gold_balance.refresh_from_db()
        return Response(
            {
                "detail": "Sellback recorded. Cash payout follows your jeweller’s showroom process.",
                "sellback": {
                    "reference": f"SB-{row.id}",
                    "grams": str(row.grams),
                    "cash_estimate_inr": str(row.cash_estimate_inr),
                    "buyback_inr_per_gram": str(row.buyback_inr_per_gram_snapshot),
                },
                "wallet": _wallet_payload(user),
            },
            status=status.HTTP_201_CREATED,
        )


class JewellerSellbackListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        qs = (
            GoldSellbackRequest.objects.filter(jeweller=user)
            .select_related("customer")
            .order_by("-created_at")[:100]
        )
        return Response({"results": [_serialize_sellback_jeweller(r) for r in qs]})
