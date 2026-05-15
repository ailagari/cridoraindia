import logging
import uuid

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MarketplaceProduct, get_or_create_ticker, jeweller_profile_for
from apps.accounts.services.admin_access import user_is_platform_admin

from .spot_prices import invalidate_spot_price_cache, public_spot_prices_payload
from .serializers import (
    AdminProductModerationSerializer,
    AdminProductRowSerializer,
    GoldTickerAdminSerializer,
    GoldTickerPublicSerializer,
    GoldTickerReadSerializer,
    JewellerPricingProfileSerializer,
    JewellerProductReadSerializer,
    JewellerProductWriteSerializer,
    PublicMarketplaceProductSerializer,
    public_jeweller_storefront,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def _forbid_non_jeweller(request):
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    if request.user.user_type != User.JEWELLER:
        return Response({"detail": "Jeweller access only."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _forbid_non_admin(request):
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    if not user_is_platform_admin(request.user):
        return Response({"detail": "Admin access only."}, status=status.HTTP_403_FORBIDDEN)
    return None


class MarketplaceGoldTickerPublicView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            from .gold_rate_alerts import maybe_notify_gold_rate_move

            maybe_notify_gold_rate_move()
        except Exception:
            logger.exception("Gold rate alert check failed")
        ticker = get_or_create_ticker()
        return Response(GoldTickerPublicSerializer(ticker).data)


class MarketplaceProductsPublicView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = MarketplaceProduct.objects.filter(
            is_published=True,
            moderation_status=MarketplaceProduct.MOD_APPROVED,
        ).select_related("jeweller")
        jid = request.query_params.get("jeweller")
        if jid and jid.isdigit():
            qs = qs.filter(jeweller_id=int(jid))
        cat = (request.query_params.get("category") or "").strip()
        if cat:
            qs = qs.filter(category__iexact=cat)
        ser = PublicMarketplaceProductSerializer()
        return Response({"results": [ser.to_representation(p) for p in qs]})


class MarketplaceProductPublicDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            product = MarketplaceProduct.objects.select_related("jeweller").get(
                pk=pk,
                is_published=True,
                moderation_status=MarketplaceProduct.MOD_APPROVED,
            )
        except MarketplaceProduct.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(PublicMarketplaceProductSerializer().to_representation(product))


class MarketplaceJewellersPublicView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = User.objects.filter(
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
        ).order_by("business_name", "email")
        city = (request.query_params.get("city") or "").strip()
        if city:
            qs = qs.filter(city__iexact=city)
        rows = [public_jeweller_storefront(u) for u in qs]
        return Response({"results": rows})


class MarketplaceJewellerDetailPublicView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            jeweller = User.objects.get(
                pk=pk,
                user_type=User.JEWELLER,
                kyc_status=User.KYC_VERIFIED,
            )
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(public_jeweller_storefront(jeweller))


class JewellerPricingProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _forbid_non_jeweller(request)
        if err:
            return err
        profile = jeweller_profile_for(request.user)
        return Response(JewellerPricingProfileSerializer(profile).data)

    def patch(self, request):
        err = _forbid_non_jeweller(request)
        if err:
            return err
        profile = jeweller_profile_for(request.user)
        ser = JewellerPricingProfileSerializer(profile, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response(JewellerPricingProfileSerializer(profile).data)


_LOGO_CT_ALLOWED = frozenset({"image/jpeg", "image/png", "image/webp"})
_LOGO_CT_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
_MAX_LOGO_BYTES = 2 * 1024 * 1024


class JewellerMarketplaceLogoUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _forbid_non_jeweller(request)
        if err:
            return err
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"detail": "file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ct = (getattr(upload, "content_type", None) or "").split(";")[0].strip().lower()
        if ct not in _LOGO_CT_ALLOWED:
            return Response(
                {"detail": "Logo must be JPEG, PNG, or WebP."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        size = int(getattr(upload, "size", 0) or 0)
        if size > _MAX_LOGO_BYTES:
            return Response(
                {"detail": "Logo must be 2 MB or smaller."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ext = _LOGO_CT_EXT[ct]
        rel = f"jeweller_logos/{request.user.pk}/{uuid.uuid4().hex}{ext}"
        saved_name = default_storage.save(rel, ContentFile(upload.read()))
        media_url = default_storage.url(saved_name)
        absolute = (
            media_url
            if isinstance(media_url, str) and media_url.startswith("http")
            else request.build_absolute_uri(media_url)
        )
        profile = jeweller_profile_for(request.user)
        profile.logo_url = absolute[:512]
        profile.save(update_fields=["logo_url", "updated_at"])
        return Response({"logo_url": profile.logo_url})


class JewellerProductListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _forbid_non_jeweller(request)
        if err:
            return err
        qs = MarketplaceProduct.objects.filter(jeweller=request.user).select_related("jeweller")
        ser = JewellerProductReadSerializer()
        return Response({"results": [ser.to_representation(p) for p in qs]})

    def post(self, request):
        err = _forbid_non_jeweller(request)
        if err:
            return err
        ser = JewellerProductWriteSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        product = ser.save(jeweller=request.user, moderation_status=MarketplaceProduct.MOD_PENDING)
        read = JewellerProductReadSerializer()
        return Response(read.to_representation(product), status=status.HTTP_201_CREATED)


class JewellerProductDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        err = _forbid_non_jeweller(request)
        if err:
            return err
        try:
            product = MarketplaceProduct.objects.select_related("jeweller").get(
                pk=pk, jeweller=request.user
            )
        except MarketplaceProduct.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(JewellerProductReadSerializer().to_representation(product))

    def patch(self, request, pk):
        err = _forbid_non_jeweller(request)
        if err:
            return err
        try:
            product = MarketplaceProduct.objects.get(pk=pk, jeweller=request.user)
        except MarketplaceProduct.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = JewellerProductWriteSerializer(product, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        product = ser.save()
        if product.moderation_status == MarketplaceProduct.MOD_REJECTED:
            product.moderation_status = MarketplaceProduct.MOD_PENDING
            product.rejection_reason = ""
            product.save(update_fields=["moderation_status", "rejection_reason", "updated_at"])
        return Response(JewellerProductReadSerializer().to_representation(product))

    def delete(self, request, pk):
        err = _forbid_non_jeweller(request)
        if err:
            return err
        try:
            product = MarketplaceProduct.objects.get(pk=pk, jeweller=request.user)
        except MarketplaceProduct.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminGoldTickerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _forbid_non_admin(request)
        if err:
            return err
        ticker = get_or_create_ticker()
        return Response(GoldTickerReadSerializer(ticker).data)

    def patch(self, request):
        err = _forbid_non_admin(request)
        if err:
            return err
        ticker = get_or_create_ticker()
        ser = GoldTickerAdminSerializer(ticker, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        ticker.refresh_from_db()
        invalidate_spot_price_cache()
        try:
            from .gold_rate_alerts import maybe_notify_gold_rate_move

            maybe_notify_gold_rate_move(force=True)
        except Exception:
            logger.exception("Gold rate alert check failed after ticker save")
        return Response(GoldTickerReadSerializer(ticker).data)


class AdminSpotPricesView(APIView):
    """Full spot payload including international raw ladder — admin-only."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _forbid_non_admin(request)
        if err:
            return err
        return Response(public_spot_prices_payload(include_live_raw=True))


class AdminMarketplaceProductListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _forbid_non_admin(request)
        if err:
            return err
        qs = MarketplaceProduct.objects.select_related("jeweller").order_by("-updated_at")
        st = (request.query_params.get("status") or "").strip()
        if st in (
            MarketplaceProduct.MOD_PENDING,
            MarketplaceProduct.MOD_APPROVED,
            MarketplaceProduct.MOD_REJECTED,
        ):
            qs = qs.filter(moderation_status=st)
        ser = AdminProductRowSerializer()
        return Response({"results": [ser.to_representation(p) for p in qs]})


class AdminMarketplaceProductModerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _forbid_non_admin(request)
        if err:
            return err
        try:
            product = MarketplaceProduct.objects.select_related("jeweller").get(pk=pk)
        except MarketplaceProduct.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        ser = AdminProductModerationSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        action = ser.validated_data["action"]
        reason = (ser.validated_data.get("reason") or "").strip()
        if action == "approve":
            product.moderation_status = MarketplaceProduct.MOD_APPROVED
            product.rejection_reason = ""
        else:
            product.moderation_status = MarketplaceProduct.MOD_REJECTED
            product.rejection_reason = reason
        product.save(update_fields=["moderation_status", "rejection_reason", "updated_at"])
        return Response(AdminProductRowSerializer().to_representation(product))
