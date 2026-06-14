"""Admin scheme template and request APIs."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services.admin_access import user_is_platform_admin
from apps.schemes.models import (
    CustomerSchemeEnrollment,
    JewellerSchemeOffering,
    SchemeRequest,
    SchemeTemplate,
)
from apps.schemes.services.presets import list_presets, preset_design
from apps.schemes.services.scheme_design_compiler import (
    compile_scheme_design,
    human_flow_summary,
    preview_calculation,
    validate_scheme_design,
)

User = get_user_model()


def _require_admin(request):
    if not user_is_platform_admin(request.user):
        return Response({"detail": "Admin only."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _serialize_template(t: SchemeTemplate) -> dict:
    return {
        "id": t.id,
        "slug": t.slug,
        "name": t.name,
        "description": t.description,
        "category": t.category,
        "icon_key": t.icon_key,
        "sort_order": t.sort_order,
        "scheme_design": t.scheme_design,
        "flow_summary": t.flow_summary,
        "status": t.status,
        "published_at": t.published_at.isoformat() if t.published_at else None,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }


class AdminSchemeTemplateListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        qs = SchemeTemplate.objects.all().order_by("sort_order", "name")
        st = request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        return Response([_serialize_template(t) for t in qs])

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"detail": "name is required."}, status=400)
        slug = (request.data.get("slug") or slugify(name))[:80]
        design = request.data.get("scheme_design") or {}
        errors = validate_scheme_design(design)
        if errors:
            return Response({"detail": errors}, status=400)
        rules = compile_scheme_design(design)
        t = SchemeTemplate.objects.create(
            slug=slug,
            name=name,
            description=request.data.get("description") or "",
            category=request.data.get("category") or "general",
            scheme_design=design,
            scheme_rules=rules,
            flow_summary=human_flow_summary(design),
            status=SchemeTemplate.STATUS_DRAFT,
        )
        return Response(_serialize_template(t), status=201)


class AdminSchemeTemplateDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        t = SchemeTemplate.objects.filter(pk=pk).first()
        if not t:
            return Response({"detail": "Not found."}, status=404)
        return Response(_serialize_template(t))

    def patch(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        t = SchemeTemplate.objects.filter(pk=pk).first()
        if not t:
            return Response({"detail": "Not found."}, status=404)
        if t.status == SchemeTemplate.STATUS_PUBLISHED:
            return Response(
                {"detail": "Deprecate published scheme before editing, or create a new draft."},
                status=400,
            )
        if "name" in request.data:
            t.name = request.data["name"]
        if "description" in request.data:
            t.description = request.data["description"]
        if "category" in request.data:
            t.category = request.data["category"]
        if "sort_order" in request.data:
            t.sort_order = int(request.data["sort_order"])
        if "scheme_design" in request.data:
            design = request.data["scheme_design"]
            errors = validate_scheme_design(design)
            if errors:
                return Response({"detail": errors}, status=400)
            t.scheme_design = design
            t.scheme_rules = compile_scheme_design(design)
            t.flow_summary = human_flow_summary(design)
        t.save()
        return Response(_serialize_template(t))

    def delete(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        t = SchemeTemplate.objects.filter(pk=pk).first()
        if not t:
            return Response({"detail": "Not found."}, status=404)
        if t.status != SchemeTemplate.STATUS_DRAFT:
            return Response(
                {
                    "detail": "Only draft templates can be deleted. Deprecate published schemes instead.",
                },
                status=400,
            )
        if JewellerSchemeOffering.objects.filter(scheme_template=t).exists():
            return Response(
                {
                    "detail": "Cannot delete: jewellers have adopted this template. Deprecate instead.",
                },
                status=400,
            )
        t.delete()
        return Response(status=204)


class AdminSchemeTemplatePublishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        t = SchemeTemplate.objects.filter(pk=pk).first()
        if not t:
            return Response({"detail": "Not found."}, status=404)
        errors = validate_scheme_design(t.scheme_design or {})
        if errors:
            return Response({"detail": errors}, status=400)
        t.scheme_rules = compile_scheme_design(t.scheme_design)
        t.flow_summary = human_flow_summary(t.scheme_design)
        t.status = SchemeTemplate.STATUS_PUBLISHED
        t.published_at = timezone.now()
        t.published_by = request.user
        t.save()
        return Response(_serialize_template(t))


def _unique_template_slug(base: str) -> str:
    slug = slugify(base)[:80] or "scheme"
    if not SchemeTemplate.objects.filter(slug=slug).exists():
        return slug
    for i in range(2, 100):
        candidate = f"{slug[:74]}-copy-{i}"[:80]
        if not SchemeTemplate.objects.filter(slug=candidate).exists():
            return candidate
    return f"{slug[:70]}-copy-{timezone.now().strftime('%H%M%S')}"[:80]


class AdminSchemeTemplateDuplicateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        source = SchemeTemplate.objects.filter(pk=pk).first()
        if not source:
            return Response({"detail": "Not found."}, status=404)
        name = (request.data.get("name") or f"{source.name} (copy)").strip()
        slug = _unique_template_slug(request.data.get("slug") or name)
        design = source.scheme_design or {}
        rules = compile_scheme_design(design)
        t = SchemeTemplate.objects.create(
            slug=slug,
            name=name,
            description=source.description,
            category=source.category,
            icon_key=source.icon_key,
            sort_order=source.sort_order,
            scheme_design=design,
            scheme_rules=rules,
            flow_summary=human_flow_summary(design),
            status=SchemeTemplate.STATUS_DRAFT,
        )
        return Response(_serialize_template(t), status=201)


class AdminSchemeTemplateDeprecateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        t = SchemeTemplate.objects.filter(pk=pk).first()
        if not t:
            return Response({"detail": "Not found."}, status=404)
        t.status = SchemeTemplate.STATUS_DEPRECATED
        t.save(update_fields=["status", "updated_at"])
        return Response(_serialize_template(t))


class AdminSchemeTemplatePreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        t = SchemeTemplate.objects.filter(pk=pk).first()
        design = request.data.get("scheme_design") or (t.scheme_design if t else {}) or {}
        sample = float(request.data.get("sample_deposit_inr") or 5000)
        errors = validate_scheme_design(design)
        if errors:
            return Response({"detail": errors, "valid": False}, status=400)
        return Response(preview_calculation(design, sample_deposit_inr=sample))


class AdminSchemePresetsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        return Response(list_presets())


class AdminSchemeFromPresetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, key):
        err = _require_admin(request)
        if err:
            return err
        design = preset_design(key)
        if not design:
            return Response({"detail": "Unknown preset."}, status=404)
        name = request.data.get("name") or key.replace("_", " ").title()
        slug = slugify(request.data.get("slug") or name)[:80]
        rules = compile_scheme_design(design)
        t = SchemeTemplate.objects.create(
            slug=slug,
            name=name,
            description=request.data.get("description") or "",
            scheme_design=design,
            scheme_rules=rules,
            flow_summary=human_flow_summary(design),
            status=SchemeTemplate.STATUS_DRAFT,
        )
        return Response(_serialize_template(t), status=201)


class AdminSchemeRequestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        qs = SchemeRequest.objects.select_related("jeweller", "resulting_template").order_by(
            "-created_at"
        )
        st = request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        return Response(
            [
                {
                    "id": r.id,
                    "jeweller_id": r.jeweller_id,
                    "jeweller_name": r.jeweller.business_name or r.jeweller.email,
                    "title": r.title,
                    "description": r.description,
                    "proposed_terms": r.proposed_terms,
                    "status": r.status,
                    "admin_notes": r.admin_notes,
                    "resulting_template_id": r.resulting_template_id,
                    "created_at": r.created_at.isoformat(),
                }
                for r in qs
            ]
        )


class AdminSchemeRequestApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        r = SchemeRequest.objects.filter(pk=pk).first()
        if not r:
            return Response({"detail": "Not found."}, status=404)
        r.status = SchemeRequest.STATUS_APPROVED
        r.admin_reviewer = request.user
        r.admin_notes = request.data.get("admin_notes") or r.admin_notes
        r.save()
        return Response({"id": r.id, "status": r.status})


class AdminSchemeRequestRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_admin(request)
        if err:
            return err
        r = SchemeRequest.objects.filter(pk=pk).first()
        if not r:
            return Response({"detail": "Not found."}, status=404)
        r.status = SchemeRequest.STATUS_REJECTED
        r.admin_reviewer = request.user
        r.admin_notes = request.data.get("admin_notes") or ""
        r.save()
        return Response({"id": r.id, "status": r.status})


class AdminSchemeEnrollmentsOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        return Response(
            {
                "templates_published": SchemeTemplate.objects.filter(
                    status=SchemeTemplate.STATUS_PUBLISHED
                ).count(),
                "active_enrollments": CustomerSchemeEnrollment.objects.filter(
                    status=CustomerSchemeEnrollment.STATUS_ACTIVE
                ).count(),
                "pending_requests": SchemeRequest.objects.filter(
                    status=SchemeRequest.STATUS_PENDING
                ).count(),
            }
        )
