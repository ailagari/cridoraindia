"""Public read-only GST billing rates configured by admin."""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services.platform_operational import platform_billing_tax_payload


class PlatformBillingTaxView(APIView):
    """Effective ornament GST rates for client-side calculators and quotes."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(platform_billing_tax_payload())
