"""Client heartbeat and PWA install telemetry."""

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .locale_utils import normalize_preferred_locale
from .services.client_telemetry import (
    client_surface_stats_payload,
    mark_pwa_installed,
    upsert_client_heartbeat,
)
from .views_admin import _require_admin


class ClientHeartbeatView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        client_id = (body.get("client_id") or "").strip()
        if not client_id or len(client_id) > 64:
            return Response({"detail": "client_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user if request.user.is_authenticated else None
        ua = (request.META.get("HTTP_USER_AGENT") or "")[:512]
        locale = normalize_preferred_locale(body.get("preferred_locale") or request.headers.get("X-Cridora-Locale"))
        upsert_client_heartbeat(
            client_id=client_id,
            surface=str(body.get("surface") or "browser")[:24],
            push_permission=str(body.get("push_permission") or "default")[:16],
            push_registered=bool(body.get("push_registered")),
            user_id=user.pk if user else None,
            user_agent=ua,
            preferred_locale=locale,
        )
        return Response({"ok": True})


class ClientPwaInstalledView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        client_id = (body.get("client_id") or "").strip()
        if not client_id:
            return Response({"detail": "client_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user if request.user.is_authenticated else None
        mark_pwa_installed(client_id, user_id=user.pk if user else None)
        return Response({"ok": True})


class AdminClientSurfaceStatsView(APIView):
    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        return Response(client_surface_stats_payload())
