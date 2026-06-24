"""Admin engagement templates and delivery analytics."""

from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import NotificationEventLog, NotificationTemplate, SystemNotificationMessage, User
from apps.accounts.services.engagement_admin_guide import engagement_admin_guide_payload
from apps.accounts.services.engagement_facts import build_engagement_facts, build_monthly_storytelling_facts
from apps.accounts.services.engagement_template_render import preview_render
from apps.accounts.services.system_notification_catalog import SYSTEM_NOTIFICATION_CATALOG
from apps.accounts.views_admin import _require_admin


def _template_payload(t: NotificationTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "category": t.category,
        "context": t.context,
        "locale": t.locale,
        "tone": t.tone,
        "title_template": t.title_template,
        "body_template": t.body_template,
        "variables": t.variables,
        "is_active": t.is_active,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


class AdminNotificationTemplatesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        qs = NotificationTemplate.objects.all().order_by("category", "context", "locale")
        active_only = request.query_params.get("active_only")
        if active_only in ("1", "true", "yes"):
            qs = qs.filter(is_active=True)
        moment = (request.query_params.get("moment") or request.query_params.get("category") or "").strip()
        if moment:
            qs = qs.filter(category=moment)
        ctx = (request.query_params.get("context") or "").strip()
        if ctx:
            qs = qs.filter(context=ctx)
        return Response({"results": [_template_payload(t) for t in qs[:200]]})

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        name = (data.get("name") or "").strip()
        title = (data.get("title_template") or "").strip()
        body = (data.get("body_template") or "").strip()
        category = (data.get("category") or data.get("moment") or "").strip()
        if not name or not title or not body or not category:
            return Response(
                {"detail": "name, category (moment), title_template, and body_template are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        t = NotificationTemplate.objects.create(
            name=name,
            category=category[:32],
            context=(data.get("context") or "default")[:32],
            locale=(data.get("locale") or "en")[:8],
            tone=(data.get("tone") or "")[:24],
            title_template=title,
            body_template=body,
            variables=data.get("variables") if isinstance(data.get("variables"), list) else [],
            is_active=bool(data.get("is_active", True)),
        )
        return Response(_template_payload(t), status=status.HTTP_201_CREATED)


class AdminNotificationTemplateDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        t = get_object_or_404(NotificationTemplate, pk=pk)
        data = request.data if isinstance(request.data, dict) else {}
        for field, key, mx in (
            ("name", "name", 120),
            ("category", "category", 32),
            ("context", "context", 32),
            ("locale", "locale", 8),
            ("tone", "tone", 24),
            ("title_template", "title_template", 180),
        ):
            if key in data:
                setattr(t, field, (data[key] or "")[:mx])
        if "body_template" in data:
            t.body_template = data["body_template"] or ""
        if "variables" in data and isinstance(data["variables"], list):
            t.variables = data["variables"]
        if "is_active" in data:
            t.is_active = bool(data["is_active"])
        t.save()
        return Response(_template_payload(t))


class AdminNotificationTemplatePreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        facts = data.get("facts") if isinstance(data.get("facts"), dict) else {}
        facts = {str(k): str(v) for k, v in facts.items()}

        if not facts:
            sample = User.objects.filter(user_type=User.CUSTOMER, is_active=True).first()
            if sample:
                facts = build_engagement_facts(sample)
                facts.update(build_monthly_storytelling_facts(sample))

        template_id = data.get("template_id")
        if template_id:
            t = get_object_or_404(NotificationTemplate, pk=template_id)
            out = preview_render(
                title_template=t.title_template,
                body_template=t.body_template,
                facts=facts,
                variables=t.variables,
            )
            out["moment"] = t.category
            out["context"] = t.context
            return Response(out)

        title_t = (data.get("title_template") or "").strip()
        body_t = (data.get("body_template") or "").strip()
        if not title_t or not body_t:
            return Response(
                {"detail": "template_id or title_template+body_template required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        variables = data.get("variables") if isinstance(data.get("variables"), list) else []
        return Response(
            preview_render(
                title_template=title_t,
                body_template=body_t,
                facts=facts,
                variables=variables,
            )
        )


class AdminNotificationVariablesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        return Response(engagement_admin_guide_payload())


class AdminNotificationStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        from apps.accounts.services.notification_stats import admin_notification_stats_payload

        return Response(admin_notification_stats_payload())


def _system_message_payload(row: SystemNotificationMessage) -> dict:
    return {
        "id": row.id,
        "key": row.key,
        "name": row.name,
        "group": row.group,
        "locale": row.locale,
        "description": row.description,
        "title_template": row.title_template,
        "body_template": row.body_template,
        "alternative_titles": row.alternative_titles if isinstance(row.alternative_titles, list) else [],
        "alternative_bodies": row.alternative_bodies if isinstance(row.alternative_bodies, list) else [],
        "variables": row.variables if isinstance(row.variables, list) else [],
        "is_active": row.is_active,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _sample_facts_for_key(key: str) -> dict[str, str]:
    samples: dict[str, dict[str, str]] = {
        "gold_price_move_body": {
            "direction_verb": "increased",
            "swing": "10.00",
            "baseline": "7,505.74",
            "current": "7,515.74",
        },
        "gold_rate_alert_title": {},
        "gold_hourly_push_title": {},
    }
    if key in samples:
        return samples[key]
    return {
        "customer_name": "Ananya",
        "jeweller_name": "Malabar Gold",
        "grams": "2.5",
        "amount_inr": "15,000",
        "loan_id": "42",
        "destination_jeweller": "Kalyan Jewellers",
        "reference": "CP-2024-001",
        "total_inr": "25,000",
        "cash_inr": "5,000",
        "title": "Gold chain",
        "new_jeweller_name": "Tanishq",
    }


class AdminSystemNotificationMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        qs = SystemNotificationMessage.objects.all().order_by("group", "key", "locale")
        group = (request.query_params.get("group") or "").strip()
        if group:
            qs = qs.filter(group=group)
        locale = (request.query_params.get("locale") or "").strip()
        if locale:
            qs = qs.filter(locale=locale)
        return Response({"results": [_system_message_payload(r) for r in qs[:500]]})


class AdminSystemNotificationMessageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        row = get_object_or_404(SystemNotificationMessage, pk=pk)
        data = request.data if isinstance(request.data, dict) else {}
        for field, key, mx in (
            ("name", "name", 160),
            ("group", "group", 32),
            ("description", "description", None),
            ("title_template", "title_template", 180),
        ):
            if key in data:
                val = data[key] or ""
                setattr(row, field, val if mx is None else str(val)[:mx])
        if "body_template" in data:
            row.body_template = data["body_template"] or ""
        for json_field in ("alternative_titles", "alternative_bodies", "variables"):
            if json_field in data and isinstance(data[json_field], list):
                cleaned = [str(v).strip() for v in data[json_field] if str(v).strip()]
                setattr(row, json_field, cleaned)
        if "is_active" in data:
            row.is_active = bool(data["is_active"])
        row.save()
        return Response(_system_message_payload(row))


class AdminSystemNotificationMessagePreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        message_id = data.get("message_id")
        facts = data.get("facts") if isinstance(data.get("facts"), dict) else {}

        if message_id:
            row = get_object_or_404(SystemNotificationMessage, pk=message_id)
            if not facts:
                facts = _sample_facts_for_key(row.key)
            facts = {str(k): str(v) for k, v in facts.items()}
            variables = row.variables if isinstance(row.variables, list) else []
            title_t = (data.get("title_template") or row.title_template or "").strip()
            body_t = (data.get("body_template") or row.body_template or "").strip()
            out = preview_render(
                title_template=title_t,
                body_template=body_t,
                facts=facts,
                variables=variables,
            )
            out["key"] = row.key
            out["locale"] = row.locale
            return Response(out)

        key = (data.get("key") or "").strip()
        if not key:
            return Response({"detail": "message_id or key required."}, status=status.HTTP_400_BAD_REQUEST)
        if not facts:
            facts = _sample_facts_for_key(key)
        facts = {str(k): str(v) for k, v in facts.items()}
        from apps.accounts.services.system_notification_render import resolve_system_notification

        loc = (data.get("locale") or "en").strip()
        resolved = resolve_system_notification(key, locale=loc, facts=facts)
        return Response(
            {
                "title": resolved.title,
                "body": resolved.body,
                "key": resolved.key,
                "locale": resolved.locale,
            }
        )


class AdminSystemNotificationCatalogView(APIView):
    """Read-only catalog metadata (groups, variable hints) for admin UI."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        groups = sorted({r["group"] for r in SYSTEM_NOTIFICATION_CATALOG})
        return Response(
            {
                "groups": groups,
                "group_labels": {
                    "transaction": "Transactions & OTP",
                    "gold": "Gold rate alerts",
                    "corridorapay": "CridoraPay",
                    "portfolio": "Portfolio & holdings",
                },
                "locales": ["en", "ml"],
            }
        )
