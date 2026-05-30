"""Jeweller-scoped scheduled campaigns via FestivalBroadcastNotification."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model

from apps.accounts.models import FestivalBroadcastNotification
from apps.accounts.serializers import (
    FestivalBroadcastNotificationCreateSerializer,
    FestivalBroadcastNotificationSerializer,
)
from apps.accounts.services.festival_broadcast import process_due_festival_broadcasts
from apps.accounts.services.notification_rate_limits import promotional_allowed_for_jeweller

User = get_user_model()


def _require_jeweller(request):
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    if request.user.user_type != User.JEWELLER:
        return Response({"detail": "Jeweller access only."}, status=status.HTTP_403_FORBIDDEN)
    return None


class JewellerCampaignListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        qs = FestivalBroadcastNotification.objects.filter(
            created_by_jeweller=request.user,
        ).order_by("-created_at")[:50]
        return Response(
            {"results": FestivalBroadcastNotificationSerializer(qs, many=True).data}
        )

    def post(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        if not promotional_allowed_for_jeweller(request.user.pk):
            return Response(
                {"detail": "Weekly promotional limit reached for this jeweller."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        data = dict(request.data) if isinstance(request.data, dict) else {}
        data.setdefault("target_type", FestivalBroadcastNotification.TARGET_SPECIFIC_JEWELLER_USERS)
        meta = data.get("target_metadata") if isinstance(data.get("target_metadata"), dict) else {}
        meta["jeweller_id"] = request.user.pk
        data["target_metadata"] = meta
        data.setdefault("engagement_context", "jeweller_campaign")
        ser = FestivalBroadcastNotificationCreateSerializer(
            data=data,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        obj.created_by_jeweller = request.user
        obj.save(update_fields=["created_by_jeweller"])
        process_due_festival_broadcasts()
        obj.refresh_from_db()
        return Response(
            FestivalBroadcastNotificationSerializer(obj).data,
            status=status.HTTP_201_CREATED,
        )
