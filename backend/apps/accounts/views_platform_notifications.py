"""In-app notification feed for non-admin users (platform broadcasts only)."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import AdminNotificationSerializer
from apps.accounts.services.festival_broadcast import prune_festival_broadcast_feed_notifications
from apps.accounts.services.notification_ack import (
    ack_shared_admin_notifications,
    festival_unread_queryset,
)


class PlatformNotificationsListView(APIView):
    """Festival / broadcast receipts visible to every signed-in role (unread only)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit") or 40)
        except ValueError:
            limit = 40
        limit = max(1, min(limit, 100))

        prune_festival_broadcast_feed_notifications()

        qs = festival_unread_queryset(request.user).order_by("-created_at")[:limit]
        rows = list(qs)
        ids = [n.id for n in rows]
        ser = AdminNotificationSerializer(
            rows,
            many=True,
            context={"request": request, "read_ids": set()},
        )
        return Response({"results": ser.data, "unread_in_feed": len(rows)})


class PlatformNotificationsMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        mark_all = bool(request.data.get("all"))
        ids = request.data.get("notification_ids")
        if not mark_all and not (isinstance(ids, list) and ids):
            return Response(
                {"detail": "Provide notification_ids (array) or all=true."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        id_list = None
        if isinstance(ids, list):
            id_list = []
            for x in ids[:200]:
                try:
                    id_list.append(int(x))
                except (TypeError, ValueError):
                    continue
        deleted = ack_shared_admin_notifications(
            request.user,
            notification_ids=id_list,
            mark_all=mark_all,
            festival_only=True,
        )
        return Response({"ok": True, "deleted": deleted})
