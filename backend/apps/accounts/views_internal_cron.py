import os

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services.festival_broadcast_scheduler import maybe_process_scheduled_broadcasts


def _cron_secret() -> str:
    return (os.environ.get("CRON_SECRET") or "").strip()


def _request_cron_secret(request) -> str:
    header = (request.headers.get("X-Cron-Secret") or "").strip()
    if header:
        return header
    auth = (request.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return ""


class InternalCronProcessBroadcastsView(APIView):
    """
    Explicit cron hook for Railway / external schedulers.

    POST with header ``X-Cron-Secret: <CRON_SECRET>`` (or ``Authorization: Bearer``).
    """

    permission_classes = [AllowAny]

    def post(self, request):
        expected = _cron_secret()
        if not expected:
            return Response(
                {"detail": "CRON_SECRET is not configured on this service."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if _request_cron_secret(request) != expected:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        n = maybe_process_scheduled_broadcasts(force=True)
        return Response({"finalized": n})
