from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .gold_identity import (
    compute_gold_upi,
    effective_custodian,
    normalize_gold_upi,
    parse_grams,
    resolve_user_by_gold_upi,
    validate_handle_local,
    validate_jeweller_code,
)
from .models import GoldBalance, GoldTransfer
from .serializers import GoldTransferNotifySerializer, GoldWalletSerializer

User = get_user_model()


def _wallet_payload(user: User) -> dict:
    bal = getattr(user, "gold_balance", None)
    grams = bal.balance_grams if bal else Decimal("0")
    return GoldWalletSerializer(
        {
            "cridora_member_id": user.cridora_member_id or "",
            "gold_upi": user.gold_upi or "",
            "gold_handle_local": user.gold_handle_local or "",
            "jeweller_code": user.jeweller_code or "",
            "default_jeweller_id": user.default_jeweller_id,
            "balance_grams": str(grams),
        }
    ).data


def _resolve_preview_user(to_user: User) -> dict:
    dj = to_user.default_jeweller
    jeweller_label = ""
    if to_user.user_type == User.JEWELLER:
        jeweller_label = to_user.business_name or to_user.email
    elif dj:
        jeweller_label = dj.business_name or dj.email
    return {
        "gold_upi": to_user.gold_upi or "",
        "display_name": f"{to_user.first_name} {to_user.last_name}".strip()
        or to_user.email,
        "user_type": to_user.user_type,
        "kyc_status": to_user.kyc_status,
        "jeweller_label": jeweller_label,
    }


class GoldWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type not in (User.CUSTOMER, User.JEWELLER):
            return Response(
                {"detail": "Gold wallet is for customers and jewellers."},
                status=status.HTTP_403_FORBIDDEN,
            )
        GoldBalance.objects.get_or_create(user=request.user, defaults={"balance_grams": Decimal("0")})
        return Response(_wallet_payload(request.user))


class GoldUPIResolveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw = (request.data.get("gold_upi") or "").strip()
        normalized = normalize_gold_upi(raw)
        if not normalized:
            return Response(
                {"found": False, "detail": "Enter a GoldUPI like username@jewellercode."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        to_user = resolve_user_by_gold_upi(normalized)
        if not to_user:
            return Response({"found": False, "gold_upi": normalized})
        if to_user.pk == request.user.pk:
            return Response(
                {"found": False, "detail": "You cannot transfer to your own GoldUPI."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if to_user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {"found": False, "detail": "Recipient is not verified yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = {"found": True, "recipient": _resolve_preview_user(to_user)}
        data["recipient"]["gold_upi"] = to_user.gold_upi or normalized
        return Response(data)


class GoldTransferCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type not in (User.CUSTOMER, User.JEWELLER):
            return Response(
                {"detail": "Transfers are for customers and jewellers."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {"detail": "Verify your account before sending gold."},
                status=status.HTTP_403_FORBIDDEN,
            )
        raw_upi = (request.data.get("gold_upi") or "").strip()
        to_user = resolve_user_by_gold_upi(raw_upi)
        if not to_user:
            return Response(
                {"detail": "GoldUPI not found. Check username@jewellercode."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if to_user.pk == user.pk:
            return Response(
                {"detail": "Cannot send gold to yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if to_user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {"detail": "Recipient is not verified."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        grams, err = parse_grams(request.data.get("grams"))
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)

        from_custodian = effective_custodian(user)
        to_custodian = effective_custodian(to_user)
        if user.user_type == User.CUSTOMER and from_custodian is None:
            return Response(
                {"detail": "Set a default jeweller before sending gold."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if to_user.user_type == User.CUSTOMER and to_custodian is None:
            return Response(
                {"detail": "Recipient must set a default jeweller to receive transfers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        detail_err = None
        try:
            with transaction.atomic():
                GoldBalance.objects.select_for_update().get_or_create(
                    user=user, defaults={"balance_grams": Decimal("0")}
                )
                GoldBalance.objects.select_for_update().get_or_create(
                    user=to_user, defaults={"balance_grams": Decimal("0")}
                )
                src = GoldBalance.objects.select_for_update().get(user=user)
                if src.balance_grams < grams:
                    detail_err = "Insufficient gold balance."
                else:
                    GoldBalance.objects.filter(pk=src.pk).update(
                        balance_grams=F("balance_grams") - grams
                    )
                    GoldBalance.objects.filter(user=to_user).update(
                        balance_grams=F("balance_grams") + grams
                    )
                    GoldTransfer.objects.create(
                        from_user=user,
                        to_user=to_user,
                        grams=grams,
                        from_custodian=from_custodian,
                        to_custodian=to_custodian,
                    )
        except GoldBalance.DoesNotExist:
            return Response(
                {"detail": "Wallet not available."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if detail_err:
            return Response({"detail": detail_err}, status=status.HTTP_400_BAD_REQUEST)

        user.gold_balance.refresh_from_db()
        return Response(
            {
                "detail": "Transfer complete.",
                "wallet": _wallet_payload(user),
                "notify": GoldTransferNotifySerializer(
                    {
                        "grams": str(grams),
                        "to_gold_upi": to_user.gold_upi or "",
                        "to_display_name": _resolve_preview_user(to_user)["display_name"],
                    }
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class GoldIdentityUpsertView(APIView):
    """Set handle and (for jewellers) storefront code. Customers need default_jeweller set first."""

    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        if user.user_type not in (User.CUSTOMER, User.JEWELLER):
            return Response(
                {"detail": "GoldUPI setup is for customers and jewellers."},
                status=status.HTTP_403_FORBIDDEN,
            )

        update_fields: list[str] = []
        if "gold_handle_local" in request.data:
            h, err = validate_handle_local(str(request.data.get("gold_handle_local", "")))
            if err:
                return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
            user.gold_handle_local = h
            update_fields.append("gold_handle_local")

        if user.user_type == User.JEWELLER and "jeweller_code" in request.data:
            c, err = validate_jeweller_code(str(request.data.get("jeweller_code", "")))
            if err:
                return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
            if (
                User.objects.filter(jeweller_code=c, user_type=User.JEWELLER)
                .exclude(pk=user.pk)
                .exists()
            ):
                return Response(
                    {"detail": "This jeweller code is already taken."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.jeweller_code = c
            update_fields.append("jeweller_code")

        if update_fields:
            user.save(update_fields=update_fields)

        new_upi = compute_gold_upi(user)
        new_upi_str = new_upi if new_upi else None
        if new_upi_str:
            conflict = (
                User.objects.filter(gold_upi__iexact=new_upi_str).exclude(pk=user.pk).exists()
            )
            if conflict:
                return Response(
                    {"detail": "This GoldUPI is already taken."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        user.gold_upi = new_upi_str
        user.save(update_fields=["gold_upi"])

        GoldBalance.objects.get_or_create(user=user, defaults={"balance_grams": Decimal("0")})

        return Response(_wallet_payload(user))


class DefaultJewellerView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Only customers set a default jeweller."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            jid = int(request.data.get("jeweller_id"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "jeweller_id must be a positive integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        jeweller = User.objects.filter(
            pk=jid, user_type=User.JEWELLER, kyc_status=User.KYC_VERIFIED
        ).first()
        if not jeweller:
            return Response(
                {"detail": "Verified jeweller not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.default_jeweller = jeweller
        user.save(update_fields=["default_jeweller"])
        upi = compute_gold_upi(user)
        user.gold_upi = upi if upi else None
        user.save(update_fields=["gold_upi"])
        GoldBalance.objects.get_or_create(user=user, defaults={"balance_grams": Decimal("0")})
        return Response(_wallet_payload(user))


class GoldTransferPublicMetaView(APIView):
    """Optional: deep-link /pay/<gold_upi> without auth — minimal public card."""

    permission_classes = [AllowAny]

    def get(self, request, gold_upi: str):
        normalized = normalize_gold_upi(gold_upi.replace("-", "@") if "@" not in gold_upi else gold_upi)
        if not normalized:
            return Response({"found": False}, status=status.HTTP_404_NOT_FOUND)
        to_user = resolve_user_by_gold_upi(normalized)
        if not to_user or to_user.kyc_status != User.KYC_VERIFIED:
            return Response({"found": False}, status=status.HTTP_404_NOT_FOUND)
        return Response({"found": True, "recipient": _resolve_preview_user(to_user)})
