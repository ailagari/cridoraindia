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
from apps.accounts.models import CrossRedemptionRequest, VaultHolding, VaultProductRedemption
from apps.accounts.vault_service import debit_customer_vault_for_transfer

from .models import MarketplaceProduct
from .redemption_cross_bridge import (
    authorize_cross_for_ornament_checkout,
    build_cross_redemption_quote_addon,
    cross_redemption_funded,
)
from .redemption_pricing import (
    checkout_totals_with_vault,
    order_vault_grams_target,
    suggested_vault_grams_for_full_order,
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


def _parse_vault_grams_param(raw: str | None) -> Decimal | None:
    if raw is None or str(raw).strip() == "":
        return None
    try:
        g = Decimal(str(raw).strip())
    except InvalidOperation:
        return None
    if g < 0:
        return None
    return g.quantize(Decimal("0.000001"))


def _redemption_quote_payload(
    product: MarketplaceProduct, customer: User, vault_grams: Decimal | None
) -> dict:
    available = _vault_grams_available(customer, product.jeweller)
    if vault_grams is None:
        grams = suggested_vault_grams_for_full_order(product, customer, available)
    else:
        grams = min(vault_grams, available)

    totals = checkout_totals_with_vault(product, customer, grams)
    cash_only = checkout_totals_with_vault(product, customer, Decimal("0"))
    suggested = suggested_vault_grams_for_full_order(product, customer, available)
    target = order_vault_grams_target(product, customer)
    j = product.jeweller
    metal_rate = totals["metal_rate_inr_per_gram"]
    cross_addon = build_cross_redemption_quote_addon(
        customer,
        listing_jeweller=j,
        grams_target=target,
        grams_available_at_listing=available,
        metal_rate_inr=metal_rate,
    )

    return {
        "product_id": product.id,
        "product_name": product.name,
        "jeweller_id": j.id,
        "jeweller_name": j.business_name or j.email or "",
        "stock_quantity": product.stock_quantity,
        "final_invoice_inr": str(totals["final_invoice_inr"]),
        "cash_payable_inr": str(totals["cash_payable_inr"]),
        "jeweller_subtotal_inr": str(totals["jeweller_subtotal_inr"]),
        "metal_rate_inr_per_gram": str(totals["metal_rate_inr_per_gram"]),
        "grams_required": str(grams),
        "grams_suggested_full_order": str(suggested),
        "grams_target_full_order": str(target),
        "vault_grams_available": str(available),
        "sufficient_vault": grams <= 0 or available >= grams,
        "vault_covers_full_order": totals["cash_payable_inr"] <= 0 and grams > 0,
        "same_store": totals["same_store"],
        "cross_platform_fee_inr": str(totals["cross_platform_fee_inr"]),
        "vault_metal_credit_inr": str(totals["vault_metal_credit_inr"]),
        "gst_on_gold_saved_inr": str(totals["gst_on_gold_saved_inr"]),
        "cash_only_final_invoice_inr": str(cash_only["final_invoice_inr"]),
        "cross_redemption": cross_addon,
    }


class VaultRedemptionQuoteView(APIView):
    """GET ?product_id=&vault_grams= — server-side checkout aligned with marketplace pricing."""

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
        if product.gold_weight_grams <= 0:
            return Response(
                {"detail": "This SKU has no gold weight configured."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        vg = _parse_vault_grams_param(request.query_params.get("vault_grams"))
        if request.query_params.get("vault_grams") is not None and vg is None:
            return Response(
                {"detail": "Invalid vault_grams."}, status=status.HTTP_400_BAD_REQUEST
            )

        payload = _redemption_quote_payload(product, request.user, vg)
        if Decimal(str(payload["metal_rate_inr_per_gram"])) <= 0:
            return Response(
                {
                    "detail": (
                        "No metal ₹/g for this listing. Set a manual gold rate on the SKU or configure "
                        "the jeweller's gold pricing."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(payload)


class VaultRedemptionCrossAuthorizeView(APIView):
    """POST { product_id, source_jeweller_id? } — start cross-redemption for ornament checkout."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN
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
        available = _vault_grams_available(request.user, product.jeweller)
        target = order_vault_grams_target(product, request.user)
        totals = checkout_totals_with_vault(product, request.user, Decimal("0"))
        metal_rate = totals["metal_rate_inr_per_gram"]
        if metal_rate <= 0:
            return Response(
                {"detail": "No metal rate for this listing."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        src_raw = body.get("source_jeweller_id")
        source_id = None
        if src_raw is not None and str(src_raw).strip() != "":
            try:
                source_id = int(src_raw)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Invalid source_jeweller_id."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        out = authorize_cross_for_ornament_checkout(
            request.user,
            product_id=product.id,
            listing_jeweller=product.jeweller,
            grams_target=target,
            grams_available_at_listing=available,
            metal_rate_inr=metal_rate,
            source_jeweller_id=source_id,
        )
        if out.get("status") == "REJECT":
            return Response(
                {"detail": out.get("detail", "Cross-redemption not available.")},
                status=status.HTTP_400_BAD_REQUEST,
            )
        quote = _redemption_quote_payload(product, request.user, None)
        out["quote"] = quote
        return Response(out)


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

        vault_grams_raw = body.get("vault_grams")
        if vault_grams_raw is None or str(vault_grams_raw).strip() == "":
            vault_grams = Decimal("0")
        else:
            try:
                vault_grams = Decimal(str(vault_grams_raw).strip()).quantize(
                    Decimal("0.000001")
                )
            except InvalidOperation:
                return Response(
                    {"detail": "Invalid vault_grams."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if vault_grams < 0:
                return Response(
                    {"detail": "vault_grams must be non-negative."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        cash_method = str(body.get("cash_payment_method") or "").strip()[:32]
        cr_raw = body.get("cross_redemption_request_id")
        cross_req: CrossRedemptionRequest | None = None
        if cr_raw is not None and str(cr_raw).strip() != "":
            try:
                cr_id = int(cr_raw)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Invalid cross_redemption_request_id."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            cross_req = CrossRedemptionRequest.objects.filter(
                pk=cr_id, user=request.user
            ).first()
            if not cross_req:
                return Response(
                    {"detail": "Cross-redemption request not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if cross_req.destination_jeweller_id != product.jeweller_id:
                return Response(
                    {"detail": "Cross-redemption destination does not match listing jeweller."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not cross_redemption_funded(cross_req):
                return Response(
                    {
                        "detail": "Cross-redemption not complete yet. Wait for approval and processing, then refresh.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        jeweller = product.jeweller
        available = _vault_grams_available(request.user, jeweller)
        grams_to_debit = min(vault_grams, available)
        totals = checkout_totals_with_vault(product, request.user, grams_to_debit)

        final_inr = totals["final_invoice_inr"]
        metal_rate = totals["metal_rate_inr_per_gram"]
        jeweller_sub = totals["jeweller_subtotal_inr"]
        same_store = totals["same_store"]
        cross = totals["cross_platform_fee_inr"]
        cash_payable = totals["cash_payable_inr"]
        gst_saved = totals["gst_on_gold_saved_inr"]

        if product.gold_weight_grams <= 0:
            return Response(
                {
                    "detail": "This SKU has no gold weight — edit the listing weight before checkout."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if metal_rate <= 0:
            return Response(
                {
                    "detail": (
                        "No metal ₹/g for this listing. Set a manual gold rate on the SKU or configure "
                        "the jeweller's gold pricing (Profile · Rates / metal board)."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if final_inr <= 0:
            return Response(
                {
                    "detail": (
                        "Order total is ₹0 — check making charges and gold weight on this SKU."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cash_payable <= 0 and grams_to_debit <= 0:
            return Response(
                {"detail": "Specify vault grams or a cash payment amount."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if grams_to_debit > 0 and available < grams_to_debit:
            return Response(
                {"detail": "Insufficient vaulted gold at this jeweller."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cash_payable > 0 and not cash_method:
            return Response(
                {"detail": "cash_payment_method required when cash is due."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exp_fin = body.get("expected_final_invoice_inr")
        exp_cash = body.get("expected_cash_payable_inr")
        exp_g = body.get("expected_grams_charged")
        if any(x is not None and str(x).strip() != "" for x in (exp_fin, exp_cash, exp_g)):
            try:
                exp_fin_d = Decimal(str(exp_fin).strip()).quantize(Decimal("0.01"))
                exp_cash_d = Decimal(str(exp_cash).strip()).quantize(Decimal("0.01"))
                exp_g_d = Decimal(str(exp_g).strip()).quantize(Decimal("0.000001"))
            except InvalidOperation:
                return Response(
                    {"detail": "Invalid expected quote fields."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if (
                exp_fin_d != final_inr.quantize(Decimal("0.01"))
                or exp_cash_d != cash_payable.quantize(Decimal("0.01"))
                or exp_g_d != grams_to_debit.quantize(Decimal("0.000001"))
            ):
                return Response(
                    {
                        "detail": "Pricing changed since quote. Refresh and try again.",
                        "quote": _redemption_quote_payload(
                            product, request.user, grams_to_debit
                        ),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

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

                if grams_to_debit > 0:
                    _lines, debit_err = debit_customer_vault_for_transfer(
                        request.user, jeweller, grams_to_debit
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
                    grams_charged=grams_to_debit,
                    final_invoice_inr=final_inr,
                    jeweller_subtotal_inr=jeweller_sub,
                    metal_rate_inr_per_gram=metal_rate,
                    same_store_checkout=same_store,
                    cross_platform_fee_inr=cross,
                    cash_paid_inr=cash_payable,
                    cash_payment_method=cash_method,
                    gst_on_gold_saved_inr=gst_saved,
                    cross_redemption_request=cross_req,
                )
                if grams_to_debit > 0:
                    release_custodial_liability_for_redemption_purchase(
                        jeweller, request.user, grams_to_debit, redemption
                    )

                MarketplaceProduct.objects.filter(pk=locked.pk).update(
                    stock_quantity=F("stock_quantity") - 1
                )
        except _RedemptionFlowError as e:
            return e.response

        assert redemption is not None
        return Response(
            {
                "detail": "Order confirmed. Collect your piece at the jeweller showroom.",
                "redemption": {
                    "id": redemption.id,
                    "reference": f"RP-{redemption.id}",
                    "grams_charged": str(redemption.grams_charged),
                    "final_invoice_inr": str(redemption.final_invoice_inr),
                    "cash_paid_inr": str(redemption.cash_paid_inr),
                    "cash_payment_method": redemption.cash_payment_method,
                    "gst_on_gold_saved_inr": str(redemption.gst_on_gold_saved_inr),
                    "product_name": redemption.product_name,
                    "jeweller_name": jeweller.business_name or jeweller.email or "",
                },
            },
            status=status.HTTP_201_CREATED,
        )


class JewellerOrnamentRedemptionListView(APIView):
    """Catalog ornament orders paid via vault and/or cash at checkout."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        qs = (
            VaultProductRedemption.objects.filter(jeweller=request.user)
            .select_related("customer")
            .order_by("-created_at")[:200]
        )
        out = []
        for r in qs:
            c = r.customer
            out.append(
                {
                    "id": r.id,
                    "reference": f"RP-{r.id}",
                    "product_name": r.product_name,
                    "customer": {
                        "email": c.email or "",
                        "name": f"{c.first_name} {c.last_name}".strip(),
                        "cridora_member_id": c.cridora_member_id or "",
                    },
                    "grams_charged": str(r.grams_charged),
                    "final_invoice_inr": str(r.final_invoice_inr),
                    "cash_paid_inr": str(r.cash_paid_inr),
                    "cash_payment_method": r.cash_payment_method or "",
                    "gst_on_gold_saved_inr": str(r.gst_on_gold_saved_inr),
                    "metal_rate_inr_per_gram": str(r.metal_rate_inr_per_gram),
                    "same_store_checkout": r.same_store_checkout,
                    "cross_platform_fee_inr": str(r.cross_platform_fee_inr),
                    "created_at": r.created_at.isoformat(),
                }
            )
        return Response({"results": out})
