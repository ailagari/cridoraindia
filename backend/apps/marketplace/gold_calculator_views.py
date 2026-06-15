"""Public gold calculator page payloads and admin ad configuration."""

from __future__ import annotations

import uuid

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services.admin_access import user_is_platform_admin
from apps.accounts.services.media_storage import delete_replaced_media_url

from .gold_rates_views import (
    _AD_IMAGE_CT_ALLOWED,
    _AD_IMAGE_CT_EXT,
    _AD_VIDEO_CT_ALLOWED,
    _AD_VIDEO_CT_EXT,
    _MAX_AD_IMAGE_BYTES,
    _MAX_AD_VIDEO_BYTES,
    _forbid_non_admin,
    _serialize_ad,
)
from .models import (
    GoldCalculatorAdPlacement,
    ensure_default_gold_calculator_ad_placements,
    get_or_create_gold_calculator_page_config,
)


def public_calculator_ads_payload() -> dict:
    ensure_default_gold_calculator_ad_placements()
    cfg = get_or_create_gold_calculator_page_config()
    placements = [
        _serialize_ad(p)
        for p in GoldCalculatorAdPlacement.objects.filter(is_active=True).order_by("sort_order", "slot")
    ]
    return {
        "adsense_enabled": cfg.adsense_enabled,
        "adsense_client_id": cfg.adsense_client_id if cfg.adsense_enabled else "",
        "page_title": cfg.page_title,
        "page_description": cfg.page_description,
        "placements": placements,
    }


class MarketplaceGoldCalculatorAdsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(public_calculator_ads_payload())


class AdminGoldCalculatorPageConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _forbid_non_admin(request)
        if err:
            return err
        ensure_default_gold_calculator_ad_placements()
        cfg = get_or_create_gold_calculator_page_config()
        placements = [
            _serialize_ad(p) for p in GoldCalculatorAdPlacement.objects.all().order_by("sort_order", "slot")
        ]
        return Response(
            {
                "adsense_enabled": cfg.adsense_enabled,
                "adsense_client_id": cfg.adsense_client_id,
                "page_title": cfg.page_title,
                "page_description": cfg.page_description,
                "placements": placements,
                "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None,
            }
        )

    def patch(self, request):
        err = _forbid_non_admin(request)
        if err:
            return err
        cfg = get_or_create_gold_calculator_page_config()
        data = request.data if isinstance(request.data, dict) else {}

        if "adsense_enabled" in data:
            cfg.adsense_enabled = bool(data["adsense_enabled"])
        if "adsense_client_id" in data:
            cfg.adsense_client_id = str(data["adsense_client_id"] or "")[:64]
        if "page_title" in data:
            cfg.page_title = str(data["page_title"] or "")[:160]
        if "page_description" in data:
            cfg.page_description = str(data["page_description"] or "")[:320]
        cfg.save()

        placements_in = data.get("placements")
        if isinstance(placements_in, list):
            for item in placements_in:
                if not isinstance(item, dict):
                    continue
                slot = str(item.get("slot") or "").strip()
                if not slot:
                    continue
                p, _ = GoldCalculatorAdPlacement.objects.get_or_create(slot=slot)
                if "label" in item:
                    p.label = str(item["label"] or "")[:120]
                if "mode" in item and item["mode"] in (
                    GoldCalculatorAdPlacement.MODE_MANUAL,
                    GoldCalculatorAdPlacement.MODE_IMAGE,
                    GoldCalculatorAdPlacement.MODE_VIDEO,
                    GoldCalculatorAdPlacement.MODE_MEDIA,
                    GoldCalculatorAdPlacement.MODE_ADSENSE,
                ):
                    p.mode = item["mode"]
                if "manual_html" in item:
                    p.manual_html = str(item["manual_html"] or "")
                if "image_url" in item:
                    new_image_url = str(item["image_url"] or "")[:512]
                    delete_replaced_media_url(old_url=p.image_url, new_url=new_image_url)
                    p.image_url = new_image_url
                if "image_link_url" in item:
                    p.image_link_url = str(item["image_link_url"] or "")[:512]
                if "image_alt" in item:
                    p.image_alt = str(item["image_alt"] or "")[:160]
                if "video_url" in item:
                    new_video_url = str(item["video_url"] or "")[:512]
                    delete_replaced_media_url(old_url=p.video_url, new_url=new_video_url)
                    p.video_url = new_video_url
                if "video_poster_url" in item:
                    new_poster_url = str(item["video_poster_url"] or "")[:512]
                    delete_replaced_media_url(old_url=p.video_poster_url, new_url=new_poster_url)
                    p.video_poster_url = new_poster_url
                if "video_link_url" in item:
                    p.video_link_url = str(item["video_link_url"] or "")[:512]
                if "video_alt" in item:
                    p.video_alt = str(item["video_alt"] or "")[:160]
                if "adsense_slot_id" in item:
                    p.adsense_slot_id = str(item["adsense_slot_id"] or "")[:64]
                if "adsense_format" in item:
                    p.adsense_format = str(item["adsense_format"] or "auto")[:24]
                if "is_active" in item:
                    p.is_active = bool(item["is_active"])
                if "sort_order" in item:
                    try:
                        p.sort_order = int(item["sort_order"])
                    except (TypeError, ValueError):
                        pass
                p.save()

        return self.get(request)


class AdminGoldCalculatorAdImageUploadView(APIView):
    """Upload a banner image for a gold calculator ad slot (admin only)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _forbid_non_admin(request)
        if err:
            return err

        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"detail": "file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ct = (getattr(upload, "content_type", None) or "").split(";")[0].strip().lower()
        if ct not in _AD_IMAGE_CT_ALLOWED:
            return Response(
                {"detail": "Image must be JPEG, PNG, or WebP."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        size = int(getattr(upload, "size", 0) or 0)
        if size > _MAX_AD_IMAGE_BYTES:
            return Response(
                {"detail": "Image must be 4 MB or smaller."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        slot = str(request.POST.get("slot") or "general").strip()[:32] or "general"
        if slot not in {c[0] for c in GoldCalculatorAdPlacement.SLOT_CHOICES}:
            slot = "general"

        ext = _AD_IMAGE_CT_EXT[ct]
        rel = f"gold_calculator_ad_images/{slot}/{uuid.uuid4().hex}{ext}"
        saved_name = default_storage.save(rel, ContentFile(upload.read()))
        media_url = default_storage.url(saved_name)
        absolute = (
            media_url
            if isinstance(media_url, str) and media_url.startswith("http")
            else request.build_absolute_uri(media_url)
        )
        return Response({"image_url": absolute[:512]})


class AdminGoldCalculatorAdVideoUploadView(APIView):
    """Upload a banner video for a gold calculator ad slot (admin only)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _forbid_non_admin(request)
        if err:
            return err

        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"detail": "file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ct = (getattr(upload, "content_type", None) or "").split(";")[0].strip().lower()
        if ct not in _AD_VIDEO_CT_ALLOWED:
            return Response(
                {"detail": "Video must be MP4 or WebM."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        size = int(getattr(upload, "size", 0) or 0)
        if size > _MAX_AD_VIDEO_BYTES:
            return Response(
                {"detail": "Video must be 16 MB or smaller."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        slot = str(request.POST.get("slot") or "general").strip()[:32] or "general"
        if slot not in {c[0] for c in GoldCalculatorAdPlacement.SLOT_CHOICES}:
            slot = "general"

        ext = _AD_VIDEO_CT_EXT[ct]
        rel = f"gold_calculator_ad_videos/{slot}/{uuid.uuid4().hex}{ext}"
        saved_name = default_storage.save(rel, ContentFile(upload.read()))
        media_url = default_storage.url(saved_name)
        absolute = (
            media_url
            if isinstance(media_url, str) and media_url.startswith("http")
            else request.build_absolute_uri(media_url)
        )
        return Response({"video_url": absolute[:512]})
