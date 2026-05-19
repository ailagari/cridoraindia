from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services.jeweller_portfolio_ledger import jeweller_portfolio_ledger_payload

User = get_user_model()


class JewellerPortfolioLedgerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        lf = (request.query_params.get("filter") or "all").strip()
        return Response(jeweller_portfolio_ledger_payload(user, ledger_filter=lf))
