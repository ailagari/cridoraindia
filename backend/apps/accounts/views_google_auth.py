"""Google OAuth login/register for customers."""

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model

from .serializers import CustomerPersonalProfileSerializer, user_auth_payload
from .services.admin_access import sync_staff_superuser_to_platform_admin
from .services.google_auth import (
    GoogleAuthError,
    authenticate_or_register_google_customer,
    google_auth_configured,
    user_profile_complete,
    verify_google_id_token,
)

User = get_user_model()


class GoogleAuthConfigView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from django.conf import settings

        client_id = (getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", None) or "").strip()
        return Response({"configured": bool(client_id), "client_id": client_id or None})


class GoogleAuthView(APIView):
    """POST { id_token, referral_code?, onboarding_jeweller_id? } — customer Google sign-in/up."""

    permission_classes = [AllowAny]

    def post(self, request):
        if not google_auth_configured():
            return Response(
                {"detail": "Google sign-in is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        body = request.data if isinstance(request.data, dict) else {}
        id_token = body.get("id_token") or body.get("credential")
        try:
            claims = verify_google_id_token(str(id_token or ""))
        except GoogleAuthError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        referral_raw = (body.get("referral_code") or "").strip() or None
        jeweller_id = body.get("onboarding_jeweller_id")
        try:
            jeweller_id = int(jeweller_id) if jeweller_id not in (None, "") else None
        except (TypeError, ValueError):
            jeweller_id = None

        try:
            user, _created, warning = authenticate_or_register_google_customer(
                claims,
                referral_code=referral_raw,
                jeweller_id=jeweller_id,
            )
        except GoogleAuthError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        user = sync_staff_superuser_to_platform_admin(user)
        payload = user_auth_payload(user)
        payload["profile_complete"] = user_profile_complete(user)
        payload["auth_provider"] = user.auth_provider
        if warning:
            payload["referral_warning"] = warning
        return Response(payload, status=status.HTTP_200_OK)


class CompleteProfileView(APIView):
    """PATCH name + phone after Google signup."""

    permission_classes = [IsAuthenticated]

    def patch(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        ser = CustomerPersonalProfileSerializer(data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        for field in ("first_name", "last_name", "phone"):
            if field in ser.validated_data:
                setattr(user, field, ser.validated_data[field])
        user.save(update_fields=[f for f in ("first_name", "last_name", "phone") if f in ser.validated_data])
        payload = user_auth_payload(user)
        payload["profile_complete"] = user_profile_complete(user)
        payload["auth_provider"] = user.auth_provider
        return Response(payload)
