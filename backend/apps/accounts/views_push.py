from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import WebPushSubscription
from .services.admin_access import user_is_platform_admin
from .webpush_service import send_push_to_user, webpush_configured

User = get_user_model()


def _require_admin(request):
    if not user_is_platform_admin(request.user):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return None


class WebPushVapidPublicKeyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        key = (getattr(settings, "WEB_PUSH_VAPID_PUBLIC_KEY", "") or "").strip()
        if not key:
            return Response({"public_key": None, "configured": False})
        return Response({"public_key": key, "configured": True})


class WebPushSubscribeView(APIView):
    """Persist Push subscription for logged-in user or anonymous PWA visitor."""

    permission_classes = [AllowAny]

    def post(self, request):
        if not webpush_configured():
            return Response(
                {"detail": "Web Push is not configured on the server."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        body = request.data
        endpoint = body.get("endpoint")
        keys = body.get("keys") or {}
        p256dh = keys.get("p256dh")
        auth = keys.get("auth")
        if not endpoint or not p256dh or not auth:
            return Response(
                {"detail": "endpoint, keys.p256dh, and keys.auth are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ua = (request.META.get("HTTP_USER_AGENT") or "")[:512]
        owner = request.user if request.user.is_authenticated else None
        WebPushSubscription.objects.update_or_create(
            endpoint=str(endpoint),
            defaults={
                "user": owner,
                "p256dh": str(p256dh),
                "auth": str(auth),
                "user_agent": ua,
            },
        )
        return Response({"ok": True}, status=status.HTTP_200_OK)


class WebPushUnsubscribeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        endpoint = request.data.get("endpoint")
        if not endpoint:
            return Response(
                {"detail": "endpoint is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        WebPushSubscription.objects.filter(endpoint=str(endpoint)).delete()
        return Response({"ok": True}, status=status.HTTP_200_OK)


class WebPushAdminSelfTestView(APIView):
    """POST a test notification to the signed-in admin's own devices."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        if not webpush_configured():
            return Response(
                {"detail": "Web Push is not configured (VAPID keys missing)."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        title = str(request.data.get("title") or "Cridora")
        body = str(request.data.get("body") or "Test notification")
        url = str(request.data.get("url") or "/")
        count = send_push_to_user(
            request.user,
            {"title": title, "body": body, "url": url, "tag": "cridora-admin-test"},
        )
        if count == 0:
            return Response(
                {"detail": "No push subscriptions for this account. Enable alerts in the app first.", "sent": 0},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"sent": count})
