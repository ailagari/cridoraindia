"""Customer vault payment for approved marketplace products (ornament redemption)."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Sum
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.jeweller_liability_service import (
    release_custodial_liability_for_redemption_purchase,
)
from apps.accounts.models import VaultHolding, VaultProductRedemption
from apps.accounts.vault_service import debit_customer_vault_for_transfer

from .models import MarketplaceProduct, get_or_create_ticker
from .redemption_pricing import (
    grams_to_charge_for_invoice,
    invoice_totals_for_vault_redemption,
)

User = get_user_model()


class _RedemptionFlowError(Exception):
    __slots__ = ("response",)

    def __init__(self, response: Response):
        self.response = response


def _vault_grams_available(customer: User, jeweller: User) -> Decimal:
    total = (
        VaultHolding.objects.filter(
            vault__owner=customer, vault__custodian=jeweller
        ).aggregate(t=Sum("balance_grams"))["t"]
        or Decimal("0")
    )
    return total


def _load_eligible_product(pk: int) -> MarketplaceProduct | None:
    try:
        return (
            MarketplaceProduct.objects.select_related(
                "jeweller", "metal_purity", "product_category"
            )
            .filter(
                pk=pk,
                is_published=True,
                moderation_status=MarketplaceProduct.MOD_APPROVED,
                jeweller__is_active=True,
                jeweller__kyc_status=User.KYC_VERIFIED,
            )
            .get()
        )
    except MarketplaceProduct.DoesNotExist:
        return None


def _redemption_quote_payload(product: MarketplaceProduct, customer: User) -> dict:
    final_inr, metal_rate, jeweller_sub, same_store = (
        invoice_totals_for_vault_redemption(product, customer)
    )
    grams_req = grams_to_charge_for_invoice(final_inr, metal_rate)
    available = _vault_grams_available(customer, product.jeweller)
    cross = Decimal("0")
    if product.is_x_redeem:
        cross = get_or_create_ticker().cross_platform_fee_inr or Decimal("0")
        if cross < 0:
            cross = Decimal("0")
    j = product.jeweller
    return {
        "product_id": product.id,
        "product_name": product.name,
        "jeweller_id": j.id,
        "jeweller_name": j.business_name or j.email or "",
        "stock_quantity": product.stock_quantity,
        "final_invoice_inr": str(final_inr),
        "jeweller_subtotal_inr": str(jeweller_sub),
        "metal_rate_inr_per_gram": str(metal_rate),
        "grams_required": str(grams_req),
        "vault_grams_available": str(available),
        "sufficient_vault": available >= grams_req,
        "same_store": same_store,
        "cross_platform_fee_inr": str(cross),
    }


class VaultRedemptionQuoteView(APIView):
    """GET ?product_id= — server-side checkout aligned with marketplace pricing."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN
            )
        raw = (request.query_params.get("product_id") or "").strip()
        if not raw.isdigit():
            return Response(
                {"detail": "product_id required."}, status=status.HTTP_400_BAD_REQUEST
            )
        product = _load_eligible_product(int(raw))
        if not product:
            return Response(
                {"detail": "Product not available."}, status=status.HTTP_404_NOT_FOUND
            )

        return Response(_redemption_quote_payload(product, request.user))


class VaultRedemptionConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN
            )
        if request.user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {"detail": "Complete KYC before redeeming with vault gold."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        body = request.data if isinstance(request.data, dict) else {}
        raw = str(body.get("product_id") or "").strip()
        if not raw.isdigit():
            return Response(
                {"detail": "product_id required."}, status=status.HTTP_400_BAD_REQUEST
            )

        product = _load_eligible_product(int(raw))
        if not product:
            return Response(
                {"detail": "Product not available."}, status=status.HTTP_404_NOT_FOUND
            )

        final_inr, metal_rate, jeweller_sub, same_store = (
            invoice_totals_for_vault_redemption(product, request.user)
        )
        grams_req = grams_to_charge_for_invoice(final_inr, metal_rate)
        if grams_req <= 0 or metal_rate <= 0:
            return Response(
                {"detail": "Invalid pricing for this product."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exp_fin_raw = body.get("expected_final_invoice_inr")
        exp_g_raw = body.get("expected_grams_required")
        exp_fin_set = exp_fin_raw is not None and str(exp_fin_raw).strip() != ""
        exp_g_set = exp_g_raw is not None and str(exp_g_raw).strip() != ""
        if exp_fin_set ^ exp_g_set:
            return Response(
                {
                    "detail": "Send both expected_final_invoice_inr and expected_grams_required, or omit both."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if exp_fin_set and exp_g_set:
            try:
                exp_fin = Decimal(str(exp_fin_raw).strip())
                exp_g = Decimal(str(exp_g_raw).strip())
            except InvalidOperation:
                return Response(
                    {"detail": "Invalid expected quote fields."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            fin_snap = final_inr.quantize(Decimal("0.01"))
            g_snap = grams_req.quantize(Decimal("0.000001"))
            exp_fin_q = exp_fin.quantize(Decimal("0.01"))
            exp_g_q = exp_g.quantize(Decimal("0.000001"))
            if fin_snap != exp_fin_q or g_snap != exp_g_q:
                return Response(
                    {
                        "detail": "Pricing changed since quote. Refresh and try again.",
                        "quote": _redemption_quote_payload(product, request.user),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        jeweller = product.jeweller
        cross = Decimal("0")
        if product.is_x_redeem:
            cross = get_or_create_ticker().cross_platform_fee_inr or Decimal("0")
            if cross < 0:
                cross = Decimal("0")

        redemption: VaultProductRedemption | None = None
        try:
            with transaction.atomic():
                locked = (
                    MarketplaceProduct.objects.select_for_update()
                    .filter(
                        pk=product.pk,
                        is_published=True,
                        moderation_status=MarketplaceProduct.MOD_APPROVED,
                        stock_quantity__gte=1,
                    )
                    .first()
                )
                if not locked:
                    raise _RedemptionFlowError(
                        Response(
                            {"detail": "Out of stock or no longer available."},
                            status=status.HTTP_409_CONFLICT,
                        )
                    )

                avail = _vault_grams_available(request.user, jeweller)
                if avail < grams_req:
                    raise _RedemptionFlowError(
                        Response(
                            {"detail": "Insufficient vaulted gold at this jeweller."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    )

                _lines, debit_err = debit_customer_vault_for_transfer(
                    request.user, jeweller, grams_req
                )
                if debit_err:
                    raise _RedemptionFlowError(
                        Response(
                            {"detail": debit_err},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    )

                redemption = VaultProductRedemption.objects.create(
                    customer=request.user,
                    jeweller=jeweller,
                    product=locked,
                    product_name=locked.name,
                    grams_charged=grams_req,
                    final_invoice_inr=final_inr,
                    jeweller_subtotal_inr=jeweller_sub,
                    metal_rate_inr_per_gram=metal_rate,
                    same_store_checkout=same_store,
                    cross_platform_fee_inr=cross,
                )
                release_custodial_liability_for_redemption_purchase(
                    jeweller, request.user, grams_req, redemption
                )

                MarketplaceProduct.objects.filter(pk=locked.pk).update(
                    stock_quantity=F("stock_quantity") - 1
                )
        except _RedemptionFlowError as e:
            return e.response

        assert redemption is not None
        return Response(
            {
                "detail": "Redemption recorded. Collect your order at the jeweller showroom.",
                "redemption": {
                    "id": redemption.id,
                    "reference": f"RP-{redemption.id}",
                    "grams_charged": str(redemption.grams_charged),
                    "final_invoice_inr": str(redemption.final_invoice_inr),
                    "product_name": redemption.product_name,
                    "jeweller_name": jeweller.business_name or jeweller.email or "",
                },
            },
            status=status.HTTP_201_CREATED,
        )
