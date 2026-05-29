"""Admin notification templates and delivery analytics."""

from django.db.models import Count
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import NotificationEventLog, NotificationTemplate
from apps.accounts.views_admin import _require_admin


class AdminNotificationTemplatesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        rows = NotificationTemplate.objects.filter(is_active=True).order_by("name")[:100]
        return Response(
            {
                "results": [
                    {
                        "id": t.id,
                        "name": t.name,
                        "category": t.category,
                        "title_template": t.title_template,
                        "body_template": t.body_template,
                    }
                    for t in rows
                ]
            }
        )

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        name = (data.get("name") or "").strip()
        title = (data.get("title_template") or "").strip()
        body = (data.get("body_template") or "").strip()
        if not name or not title or not body:
            return Response(
                {"detail": "name, title_template, and body_template are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        t = NotificationTemplate.objects.create(
            name=name,
            category=(data.get("category") or "promo")[:24],
            title_template=title,
            body_template=body,
        )
        return Response({"id": t.id, "name": t.name}, status=status.HTTP_201_CREATED)


class AdminNotificationStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        delivered = NotificationEventLog.objects.filter(
            event_type=NotificationEventLog.EVENT_DELIVERED
        ).count()
        clicked = NotificationEventLog.objects.filter(
            event_type=NotificationEventLog.EVENT_CLICKED
        ).count()
        by_category = (
            NotificationEventLog.objects.filter(
                event_type=NotificationEventLog.EVENT_DELIVERED
            )
            .values("category")
            .annotate(c=Count("id"))
            .order_by("-c")[:20]
        )
        open_rate = round((clicked / delivered * 100), 2) if delivered else 0
        return Response(
            {
                "delivered_count": delivered,
                "clicked_count": clicked,
                "open_rate_percent": open_rate,
                "by_category": list(by_category),
            }
        )
