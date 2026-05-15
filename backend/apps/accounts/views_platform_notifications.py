"""In-app notification feed for non-admin users (platform broadcasts only)."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AdminNotification, AdminNotificationRead
from apps.accounts.serializers import AdminNotificationSerializer


class PlatformNotificationsListView(APIView):
    """Festival / broadcast receipts visible to every signed-in role."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit") or 40)
        except ValueError:
            limit = 40
        limit = max(1, min(limit, 100))

        qs = AdminNotification.objects.filter(
            kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT,
        ).order_by("-created_at")[:limit]
        rows = list(qs)
        ids = [n.id for n in rows]
        read_ids = set(
            AdminNotificationRead.objects.filter(
                user=request.user, notification_id__in=ids
            ).values_list("notification_id", flat=True)
        )
        unread_in_feed = sum(1 for pk in ids if pk not in read_ids)
        ser = AdminNotificationSerializer(
            rows,
            many=True,
            context={"request": request, "read_ids": read_ids},
        )
        return Response({"results": ser.data, "unread_in_feed": unread_in_feed})


class PlatformNotificationsMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        mark_all = bool(request.data.get("all"))
        ids = request.data.get("notification_ids")
        base = AdminNotification.objects.filter(
            kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT,
        )
        if mark_all:
            qs = base.order_by("-id")[:500]
        elif isinstance(ids, list) and ids:
            qs = base.filter(id__in=ids[:200])
        else:
            return Response(
                {"detail": "Provide notification_ids (array) or all=true."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for notif in qs.iterator(chunk_size=100):
            AdminNotificationRead.objects.get_or_create(
                user=request.user, notification=notif
            )
        return Response({"ok": True})
