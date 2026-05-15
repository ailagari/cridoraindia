from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .jeweller_liability_service import jeweller_liability_grams
from .wallet_extras import (
    customer_completed_fractional_ledger,
    customer_portfolio_unrealized_summary,
    jeweller_recent_liability_credits,
)
from .gold_identity import (
    compute_gold_upi,
    effective_custodian,
    normalize_cridora_vault_public_id,
    normalize_gold_upi,
    parse_grams,
    resolve_owner_by_vault_public_id,
    resolve_user_by_gold_upi,
    validate_handle_local,
    validate_jeweller_code,
)
from .models import GoldBalance, GoldTransfer
from .serializers import GoldTransferNotifySerializer, GoldWalletSerializer
from .vault_service import (
    credit_customer_fractional,
    debit_customer_fractional,
    jeweller_custody_vault_payload,
    legacy_credit_jeweller_balance,
    legacy_debit_jeweller_balance,
    migrate_customer_legacy_balance_if_needed,
    refresh_vault_public_ids_for_owner,
    sync_customer_aggregate_balance,
    wallet_vault_payload,
)

User = get_user_model()


def _wallet_payload(user: User) -> dict:
    if user.user_type == User.CUSTOMER:
        sync_customer_aggregate_balance(user)
    bal = getattr(user, "gold_balance", None)
    grams = bal.balance_grams if bal else Decimal("0")
    handle = (user.gold_handle_local or "").strip().lower()
    code = (user.jeweller_code or "").strip().lower()
    cridora_global = f"{handle}@cridora" if handle else ""
    merchant_id = f"{code}@cridora" if code else ""
    vaults = wallet_vault_payload(user) if user.user_type == User.CUSTOMER else []
    liability_s = ""
    if user.user_type == User.JEWELLER:
        liability_s = str(jeweller_liability_grams(user))
    frac_ledger = (
        customer_completed_fractional_ledger(user)
        if user.user_type == User.CUSTOMER
        else []
    )
    liab_credits = (
        jeweller_recent_liability_credits(user)
        if user.user_type == User.JEWELLER
        else []
    )
    pnl_block = (
        customer_portfolio_unrealized_summary(user, grams, vaults)
        if user.user_type == User.CUSTOMER
        else None
    )
    return GoldWalletSerializer(
        {
            "cridora_member_id": user.cridora_member_id or "",
            "cridora_global_id": cridora_global,
            "merchant_cridora_id": merchant_id,
            "gold_upi": user.gold_upi or "",
            "gold_handle_local": user.gold_handle_local or "",
            "jeweller_code": user.jeweller_code or "",
            "default_jeweller_id": user.default_jeweller_id,
            "jeweller_pref_nearby_id": user.jeweller_pref_nearby_id,
            "jeweller_pref_ornament_id": user.jeweller_pref_ornament_id,
            "jeweller_pref_redemption_id": user.jeweller_pref_redemption_id,
            "balance_grams": str(grams),
            "vaults": vaults,
            "custodial_liability_grams": liability_s,
            "fractional_ledger": frac_ledger,
            "recent_liability_credits": liab_credits,
            "portfolio_unrealized": pnl_block,
        }
    ).data


def _resolve_preview_user(
    to_user: User, *, destination_handle: str | None = None
) -> dict:
    dj = to_user.default_jeweller
    jeweller_label = ""
    if to_user.user_type == User.JEWELLER:
        jeweller_label = to_user.business_name or to_user.email
    elif dj:
        jeweller_label = dj.business_name or dj.email
    return {
        "gold_upi": destination_handle or (to_user.gold_upi or ""),
        "display_name": f"{to_user.first_name} {to_user.last_name}".strip()
        or to_user.email,
        "user_type": to_user.user_type,
        "kyc_status": to_user.kyc_status,
        "jeweller_label": jeweller_label,
    }


def _resolve_transfer_recipient(raw: str) -> tuple[User | None, str | None]:
    vault_key = normalize_cridora_vault_public_id(raw)
    if vault_key:
        return resolve_owner_by_vault_public_id(vault_key), vault_key
    normalized = normalize_gold_upi(raw)
    if not normalized:
        return None, None
    return resolve_user_by_gold_upi(normalized), normalized


class GoldWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type not in (User.CUSTOMER, User.JEWELLER):
            return Response(
                {"detail": "Gold wallet is for customers and jewellers."},
                status=status.HTTP_403_FORBIDDEN,
            )
        GoldBalance.objects.get_or_create(
            user=request.user, defaults={"balance_grams": Decimal("0")}
        )
        return Response(_wallet_payload(request.user))


class JewellerCustodyVaultsView(APIView):
    """Customer fractional vault balances custodied by this jeweller (non-zero only)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        rows = jeweller_custody_vault_payload(user)
        total_g = sum(Decimal(r["fractional_grams"]) for r in rows)
        est_inr_total = sum(Decimal(r["estimated_fractional_value_inr"] or "0") for r in rows)
        return Response(
            {
                "results": rows,
                "custodian_fractional_grams_total": str(total_g),
                "custodian_estimated_value_inr_total": str(est_inr_total.quantize(Decimal("0.01"))),
            }
        )


class GoldUPIResolveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw = (request.data.get("gold_upi") or "").strip()
        to_user, dest_handle = _resolve_transfer_recipient(raw)
        if not dest_handle:
            return Response(
                {
                    "found": False,
                    "detail": "Enter username@jewellercode or handle.jewellercode@cridora.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not to_user:
            return Response({"found": False, "gold_upi": dest_handle})
        if to_user.pk == request.user.pk:
            return Response(
                {"found": False, "detail": "You cannot transfer to your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if to_user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {"found": False, "detail": "Recipient is not verified yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = {
            "found": True,
            "recipient": _resolve_preview_user(to_user, destination_handle=dest_handle),
        }
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
        to_user, dest_handle = _resolve_transfer_recipient(raw_upi)
        if not dest_handle or not to_user:
            return Response(
                {
                    "detail": "Recipient not found. Use username@jewellercode or handle.jewellercode@cridora.",
                },
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
                if user.user_type == User.CUSTOMER:
                    detail_err = debit_customer_fractional(
                        user, from_custodian, grams
                    )
                else:
                    detail_err = legacy_debit_jeweller_balance(user, grams)
                if detail_err:
                    raise ValueError(detail_err)
                if to_user.user_type == User.CUSTOMER:
                    credit_customer_fractional(to_user, to_custodian, grams)
                else:
                    legacy_credit_jeweller_balance(to_user, grams)
                GoldTransfer.objects.create(
                    from_user=user,
                    to_user=to_user,
                    grams=grams,
                    from_custodian=from_custodian,
                    to_custodian=to_custodian,
                )
        except ValueError as e:
            detail_err = str(e)
        if detail_err:
            return Response({"detail": detail_err}, status=status.HTTP_400_BAD_REQUEST)

        if hasattr(user, "gold_balance"):
            user.gold_balance.refresh_from_db()
        return Response(
            {
                "detail": "Transfer complete.",
                "wallet": _wallet_payload(user),
                "notify": GoldTransferNotifySerializer(
                    {
                        "grams": str(grams),
                        "to_gold_upi": dest_handle,
                        "to_display_name": _resolve_preview_user(
                            to_user, destination_handle=dest_handle
                        )["display_name"],
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
            taken = (
                User.objects.filter(gold_handle_local__iexact=h)
                .exclude(pk=user.pk)
                .exists()
            )
            if taken:
                return Response(
                    {"detail": "This Cridora handle is already taken."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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

        if user.user_type == User.CUSTOMER:
            refresh_vault_public_ids_for_owner(user)

        return Response(_wallet_payload(user))


class DefaultJewellerView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        if user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Only customers set default jewellers."},
                status=status.HTTP_403_FORBIDDEN,
            )
        update_fields: list[str] = []

        if "jeweller_id" in request.data:
            try:
                jid = int(request.data.get("jeweller_id"))
            except (TypeError, ValueError):
                return Response(
                    {"detail": "jeweller_id must be an integer."},
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
            update_fields.append("default_jeweller")
            migrate_customer_legacy_balance_if_needed(user, jeweller)

        def _opt_jeweller(field_name: str, body_key: str):
            nonlocal update_fields
            if body_key not in request.data:
                return
            raw_val = request.data.get(body_key)
            if raw_val in (None, ""):
                setattr(user, field_name, None)
                update_fields.append(field_name)
                return
            try:
                jid = int(raw_val)
            except (TypeError, ValueError):
                raise ValueError(f"{body_key} must be null or a jeweller id.")
            j = User.objects.filter(
                pk=jid, user_type=User.JEWELLER, kyc_status=User.KYC_VERIFIED
            ).first()
            if not j:
                raise ValueError(f"Verified jeweller not found for {body_key}.")
            setattr(user, field_name, j)
            update_fields.append(field_name)

        try:
            _opt_jeweller("jeweller_pref_nearby", "nearby_jeweller_id")
            _opt_jeweller("jeweller_pref_ornament", "ornament_jeweller_id")
            _opt_jeweller("jeweller_pref_redemption", "redemption_jeweller_id")
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if update_fields:
            user.save(update_fields=list(dict.fromkeys(update_fields)))
        upi = compute_gold_upi(user)
        user.gold_upi = upi if upi else None
        user.save(update_fields=["gold_upi"])
        GoldBalance.objects.get_or_create(user=user, defaults={"balance_grams": Decimal("0")})
        sync_customer_aggregate_balance(user)
        return Response(_wallet_payload(user))


class GoldTransferPublicMetaView(APIView):
    """Optional: deep-link /pay/<gold_upi> without auth — minimal public card."""

    permission_classes = [AllowAny]

    def get(self, request, gold_upi: str):
        raw = gold_upi.replace("-", "@") if "@" not in gold_upi else gold_upi
        vu = resolve_owner_by_vault_public_id(raw)
        if vu and vu.kyc_status == User.KYC_VERIFIED:
            return Response(
                {
                    "found": True,
                    "recipient": _resolve_preview_user(vu, destination_handle=raw.strip().lower()),
                }
            )
        normalized = normalize_gold_upi(raw)
        if not normalized:
            return Response({"found": False}, status=status.HTTP_404_NOT_FOUND)
        to_user = resolve_user_by_gold_upi(normalized)
        if not to_user or to_user.kyc_status != User.KYC_VERIFIED:
            return Response({"found": False}, status=status.HTTP_404_NOT_FOUND)
        return Response({"found": True, "recipient": _resolve_preview_user(to_user)})
