"""Public Kerala gold rates page payloads and admin ad configuration."""

from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services.admin_access import user_is_platform_admin

from .kerala_board_history import (
    fetch_board_daily_table,
    fetch_board_history_payload,
    kerala_board_history_latest_point,
    normalize_board_metal_param,
    normalize_board_range_param,
    yesterday_change_for_metal,
)
from .models import GoldRatesAdPlacement, ensure_default_gold_rates_ad_placements, get_or_create_gold_rates_page_config
from .spot_prices import public_spot_prices_payload


def _forbid_non_admin(request):
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    if not user_is_platform_admin(request.user):
        return Response({"detail": "Admin access only."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _serialize_ad(p: GoldRatesAdPlacement) -> dict:
    return {
        "id": p.id,
        "slot": p.slot,
        "label": p.label,
        "mode": p.mode,
        "manual_html": p.manual_html,
        "image_url": p.image_url,
        "image_link_url": p.image_link_url,
        "image_alt": p.image_alt,
        "adsense_slot_id": p.adsense_slot_id,
        "adsense_format": p.adsense_format or "auto",
        "is_active": p.is_active,
        "sort_order": p.sort_order,
    }


def public_ads_payload() -> dict:
    ensure_default_gold_rates_ad_placements()
    cfg = get_or_create_gold_rates_page_config()
    placements = [
        _serialize_ad(p)
        for p in GoldRatesAdPlacement.objects.filter(is_active=True).order_by("sort_order", "slot")
    ]
    return {
        "adsense_enabled": cfg.adsense_enabled,
        "adsense_client_id": cfg.adsense_client_id if cfg.adsense_enabled else "",
        "page_title": cfg.page_title,
        "page_description": cfg.page_description,
        "placements": placements,
    }


def public_kerala_rates_payload() -> dict:
    from .josalukkas_rates import get_josalukkas_spot_payload_cached

    board_live = get_josalukkas_spot_payload_cached()
    spot = public_spot_prices_payload(include_live_raw=False)
    board: dict = {}
    if isinstance(board_live, dict) and isinstance(board_live.get("gold"), dict):
        board = {
            "gold": board_live["gold"],
            "silver": board_live.get("silver") if isinstance(board_live.get("silver"), dict) else {},
            "source": board_live.get("source"),
            "source_updated_at": board_live.get("source_updated_at"),
            "rate_date": board_live.get("rate_date"),
        }
    elif isinstance(spot.get("kerala_board"), dict):
        board = spot["kerala_board"]
    board_gold = board.get("gold") if isinstance(board.get("gold"), dict) else {}
    board_silver = board.get("silver") if isinstance(board.get("silver"), dict) else {}
    spot_silver = spot.get("silver") if isinstance(spot.get("silver"), dict) else {}
    spot_gold = spot.get("gold") if isinstance(spot.get("gold"), dict) else {}

    silver_999 = board_silver.get("999")
    if silver_999 is None:
        silver_999 = spot_silver.get("999")

    gold_rates = {
        "18K": board_gold.get("18K") or spot_gold.get("18K"),
        "22K": board_gold.get("22K") or spot_gold.get("22K"),
        "24K": board_gold.get("24K") or spot_gold.get("24K"),
        "21K": board_gold.get("21K") or spot_gold.get("21K"),
    }
    silver_rates = {"999": silver_999, "925": spot_silver.get("925")}

    changes = {
        "22K": yesterday_change_for_metal("22K"),
        "24K": yesterday_change_for_metal("24K"),
        "18K": yesterday_change_for_metal("18K"),
        "silver999": yesterday_change_for_metal("silver999"),
    }

    return {
        "region": "Kerala",
        "currency": "INR",
        "unit": "per_gram",
        "source": board.get("source") or spot.get("cridora_base_source") or spot.get("source"),
        "source_updated_at": board.get("source_updated_at"),
        "rate_date": board.get("rate_date"),
        "gold": {k: v for k, v in gold_rates.items() if v is not None},
        "silver": {k: v for k, v in silver_rates.items() if v is not None},
        "daily_change": changes,
        "latest_point": kerala_board_history_latest_point(board or spot),
        "note": spot.get("note"),
    }


class MarketplaceKeralaGoldRatesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(public_kerala_rates_payload())


class MarketplaceKeralaGoldRatesHistoryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        raw_range = (request.query_params.get("range") or "1m").strip()
        raw_metal = (request.query_params.get("metal") or "22K").strip()
        body = fetch_board_history_payload(
            range_key=normalize_board_range_param(raw_range),
            metal=normalize_board_metal_param(raw_metal),
        )
        body["latest"] = public_kerala_rates_payload().get("latest_point")
        return Response(body)


class MarketplaceKeralaGoldRatesDailyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit") or 60)
        except (TypeError, ValueError):
            limit = 60
        try:
            offset = int(request.query_params.get("offset") or 0)
        except (TypeError, ValueError):
            offset = 0
        return Response(fetch_board_daily_table(limit=limit, offset=offset))


class MarketplaceGoldRatesAdsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(public_ads_payload())


class AdminGoldRatesPageConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _forbid_non_admin(request)
        if err:
            return err
        ensure_default_gold_rates_ad_placements()
        cfg = get_or_create_gold_rates_page_config()
        placements = [_serialize_ad(p) for p in GoldRatesAdPlacement.objects.all().order_by("sort_order", "slot")]
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
        cfg = get_or_create_gold_rates_page_config()
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
                p, _ = GoldRatesAdPlacement.objects.get_or_create(slot=slot)
                if "label" in item:
                    p.label = str(item["label"] or "")[:120]
                if "mode" in item and item["mode"] in (
                    GoldRatesAdPlacement.MODE_MANUAL,
                    GoldRatesAdPlacement.MODE_IMAGE,
                    GoldRatesAdPlacement.MODE_ADSENSE,
                ):
                    p.mode = item["mode"]
                if "manual_html" in item:
                    p.manual_html = str(item["manual_html"] or "")
                if "image_url" in item:
                    p.image_url = str(item["image_url"] or "")[:512]
                if "image_link_url" in item:
                    p.image_link_url = str(item["image_link_url"] or "")[:512]
                if "image_alt" in item:
                    p.image_alt = str(item["image_alt"] or "")[:160]
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
