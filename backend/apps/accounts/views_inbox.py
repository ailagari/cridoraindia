"""Unified in-app notification inbox for signed-in users."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PortfolioUserNotification
from apps.accounts.services.festival_broadcast import prune_festival_broadcast_feed_notifications
from apps.accounts.services.notification_ack import (
    ack_portfolio_notifications,
    ack_shared_admin_notifications,
    festival_unread_queryset,
)
from apps.accounts.services.notification_preferences import (
    get_or_create_preferences,
    preferences_payload,
)
from apps.accounts.serializers import AdminNotificationSerializer


def _inbox_row_dict(n: PortfolioUserNotification) -> dict:
    branding = ""
    if n.jeweller_id and n.jeweller:
        name = (n.jeweller.business_name or n.jeweller.email or "").strip()
        if name:
            branding = f"{name} via Cridora"
    return {
        "id": f"inbox-{n.id}",
        "source": "inbox",
        "numeric_id": n.id,
        "kind": n.kind,
        "category": n.category,
        "priority": n.priority,
        "notification_type": n.notification_type,
        "title": n.title,
        "body": n.body,
        "link_path": n.link_path,
        "unread": True,
        "created_at": n.created_at.isoformat(),
        "branding_label": branding,
        "image_url": n.image_url or "",
        "logo_url": n.logo_url or "",
    }


def _festival_row_dict(request, n) -> dict:
    ser = AdminNotificationSerializer(n, context={"request": request, "read_ids": set()})
    data = ser.data
    data["id"] = f"festival-{n.id}"
    data["source"] = "festival"
    data["numeric_id"] = n.id
    data["category"] = "promo"
    data["priority"] = "low"
    data["unread"] = True
    return data


class InboxNotificationsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit") or 40)
        except ValueError:
            limit = 40
        limit = max(1, min(limit, 100))
        category = (request.query_params.get("category") or "").strip()

        prune_festival_broadcast_feed_notifications()

        inbox_qs = PortfolioUserNotification.objects.filter(
            user=request.user, read_at__isnull=True
        ).select_related("jeweller")
        if category:
            inbox_qs = inbox_qs.filter(category=category)

        fest_qs = festival_unread_queryset(request.user)
        if category and category != "promo":
            fest_qs = fest_qs.none()

        inbox_rows = list(inbox_qs.order_by("-created_at")[:limit])
        fest_rows = list(fest_qs.order_by("-created_at")[:limit])

        merged = [_inbox_row_dict(n) for n in inbox_rows] + [
            _festival_row_dict(request, n) for n in fest_rows
        ]
        merged.sort(key=lambda r: r.get("created_at") or "", reverse=True)
        merged = merged[:limit]

        unread_inbox = PortfolioUserNotification.objects.filter(
            user=request.user, read_at__isnull=True
        ).count()
        unread_fest = fest_qs.count() if not category or category == "promo" else 0

        return Response(
            {
                "results": merged,
                "unread_count": unread_inbox + unread_fest,
                "unread_in_feed": len(merged),
            }
        )


class InboxUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        prune_festival_broadcast_feed_notifications()
        inbox = PortfolioUserNotification.objects.filter(
            user=request.user, read_at__isnull=True
        ).count()
        fest = festival_unread_queryset(request.user).count()
        return Response({"unread_count": inbox + fest})


class InboxAckView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        mark_all = bool(request.data.get("all"))
        raw_ids = request.data.get("notification_ids")
        inbox_ids: list[int] = []
        festival_ids: list[int] = []
        if isinstance(raw_ids, list):
            for item in raw_ids[:200]:
                s = str(item)
                if s.startswith("inbox-"):
                    try:
                        inbox_ids.append(int(s[6:]))
                    except ValueError:
                        pass
                elif s.startswith("festival-"):
                    try:
                        festival_ids.append(int(s[9:]))
                    except ValueError:
                        pass
                elif s.isdigit():
                    inbox_ids.append(int(s))

        deleted = 0
        if mark_all:
            deleted += ack_portfolio_notifications(request.user, mark_all=True)
            deleted += ack_shared_admin_notifications(
                request.user, mark_all=True, festival_only=True
            )
        else:
            if inbox_ids:
                deleted += ack_portfolio_notifications(
                    request.user, notification_ids=inbox_ids
                )
            if festival_ids:
                deleted += ack_shared_admin_notifications(
                    request.user,
                    notification_ids=festival_ids,
                    festival_only=True,
                )
        return Response({"ok": True, "deleted": deleted})


class InboxPreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pref = get_or_create_preferences(request.user)
        return Response(preferences_payload(pref))

    def patch(self, request):
        pref = get_or_create_preferences(request.user)
        data = request.data if isinstance(request.data, dict) else {}
        bool_fields = (
            "allow_promotional",
            "allow_gold_alerts",
            "allow_portfolio_alerts",
            "allow_jeweller_campaigns",
            "allow_festival_alerts",
            "allow_push_notifications",
            "allow_sound",
        )
        for key in bool_fields:
            if key in data:
                setattr(pref, key, bool(data[key]))
        for key in ("quiet_hours_start", "quiet_hours_end"):
            if key in data:
                val = data[key]
                if val in (None, "", "null"):
                    setattr(pref, key, None)
                elif isinstance(val, str):
                    from datetime import datetime

                    parsed = None
                    for fmt in ("%H:%M:%S", "%H:%M"):
                        try:
                            parsed = datetime.strptime(val.strip(), fmt).time()
                            break
                        except ValueError:
                            continue
                    setattr(pref, key, parsed)
                else:
                    setattr(pref, key, val)
        pref.save()
        return Response(preferences_payload(pref))
