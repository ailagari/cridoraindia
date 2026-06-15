from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import FestivalBroadcastNotification
from .serializers import (
    FestivalBroadcastNotificationCreateSerializer,
    FestivalBroadcastNotificationSerializer,
)
from .services.festival_broadcast import prune_festival_broadcast_history
from .services.festival_broadcast_scheduler import maybe_process_scheduled_broadcasts
from .views_admin import _require_admin


class AdminFestivalBroadcastListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        maybe_process_scheduled_broadcasts(force=True)
        qs = (
            FestivalBroadcastNotification.objects.select_related("created_by")
            .order_by("-created_at")[:100]
        )
        ser = FestivalBroadcastNotificationSerializer(qs, many=True)
        return Response({"results": ser.data})

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        ser = FestivalBroadcastNotificationCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        maybe_process_scheduled_broadcasts(force=True)
        obj.refresh_from_db()
        out = FestivalBroadcastNotificationSerializer(obj)
        return Response(out.data, status=status.HTTP_201_CREATED)


class AdminFestivalBroadcastCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        with transaction.atomic():
            row = (
                FestivalBroadcastNotification.objects.select_for_update()
                .filter(pk=pk)
                .first()
            )
            if row is None:
                return Response(
                    {"detail": "Not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if row.status != FestivalBroadcastNotification.STATUS_PENDING:
                return Response(
                    {"detail": "Only pending broadcasts can be cancelled."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            row.status = FestivalBroadcastNotification.STATUS_CANCELLED
            row.save(update_fields=["status"])
        prune_festival_broadcast_history()
        return Response(FestivalBroadcastNotificationSerializer(row).data)
