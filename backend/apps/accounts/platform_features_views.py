"""Public and admin API for platform feature rollout."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .platform_features import (
    admin_section_enabled,
    customer_section_enabled,
    effective_feature_flags,
    feature_catalog_for_admin,
    jeweller_section_enabled,
    set_feature_flags,
)
from .views_admin import _require_admin


class PlatformFeaturesView(APIView):
    """Effective feature flags for client nav and UI gating."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        flags = effective_feature_flags()
        return Response(
            {
                "flags": flags,
                "customer_sections": {
                    section: customer_section_enabled(section, flags)
                    for section in _all_customer_sections()
                },
                "jeweller_sections": {
                    section: jeweller_section_enabled(section, flags)
                    for section in _all_jeweller_sections()
                },
                "admin_sections": {
                    section: admin_section_enabled(section, flags)
                    for section in _all_admin_sections()
                },
            }
        )


def _all_customer_sections() -> tuple[str, ...]:
    sections: set[str] = set()
    from .platform_features import FEATURE_DEFINITIONS

    for d in FEATURE_DEFINITIONS:
        sections.update(d.get("customer_sections", ()))
    return tuple(sorted(sections))


def _all_jeweller_sections() -> tuple[str, ...]:
    sections: set[str] = set()
    from .platform_features import FEATURE_DEFINITIONS

    for d in FEATURE_DEFINITIONS:
        sections.update(d.get("jeweller_sections", ()))
    return tuple(sorted(sections))


def _all_admin_sections() -> tuple[str, ...]:
    sections: set[str] = set()
    from .platform_features import FEATURE_DEFINITIONS

    for d in FEATURE_DEFINITIONS:
        sections.update(d.get("admin_sections", ()))
    return tuple(sorted(sections))


class AdminFeatureRolloutView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        return Response({"catalog": feature_catalog_for_admin(), "flags": effective_feature_flags()})

    def patch(self, request):
        err = _require_admin(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        raw = data.get("flags")
        if not isinstance(raw, dict):
            return Response({"detail": "Send flags object with feature keys."}, status=400)
        try:
            flags = set_feature_flags(raw)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response({"catalog": feature_catalog_for_admin(), "flags": flags})
