"""UPI reconciliation: SMS signals, payment ack, jeweller batch review."""

from __future__ import annotations

from datetime import datetime

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .fractional_views import _ser_purchase
from .platform_features import FeatureGatedViewMixin
from .models import FractionalGoldPurchase
from .services.fractional_upi import is_payment_expired
from .services.payment_reconciliation.confirm import confirm_fractional_purchase
from .services.payment_reconciliation.engine import run_reconciliation
from .services.payment_reconciliation.signals import (
    capture_jeweller_confirmation_signal,
    capture_sms_signal,
    capture_user_input_signal,
)

User = get_user_model()

RECONCILABLE_STATUSES = (
    FractionalGoldPurchase.PENDING_PAYMENT,
    FractionalGoldPurchase.SIGNAL_RECEIVED,
    FractionalGoldPurchase.PENDING_REVIEW,
    FractionalGoldPurchase.NEEDS_MANUAL_VERIFICATION,
    FractionalGoldPurchase.AWAITING_UTR_VERIFY,
)


def _parse_received_at(raw: str) -> datetime:
    if raw:
        parsed = parse_datetime(raw)
        if parsed is not None:
            if timezone.is_naive(parsed):
                return timezone.make_aware(parsed)
            return parsed
    return timezone.now()


def _enrich_purchase_row(p: FractionalGoldPurchase) -> dict:
    row = _ser_purchase(p)
    row["order_reference"] = p.order_reference
    row["reconciliation_score"] = p.reconciliation_score
    row["reconciliation_flags"] = p.reconciliation_flags or {}
    row["customer"] = {
        "email": p.customer.email,
        "name": f"{p.customer.first_name} {p.customer.last_name}".strip(),
        "cridora_member_id": p.customer.cridora_member_id or "",
    }
    return row


class FractionalOrderPaymentAckView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    """Customer acknowledges payment without UTR."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Customers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            with transaction.atomic():
                purchase = FractionalGoldPurchase.objects.select_for_update().get(
                    pk=pk,
                    customer=request.user,
                    payment_method=FractionalGoldPurchase.PAY_UPI,
                )
                if purchase.status not in RECONCILABLE_STATUSES:
                    return Response(
                        {"detail": "Order is not awaiting payment."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if is_payment_expired(purchase):
                    return Response(
                        {"detail": "Payment window expired. Place a new order."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                capture_user_input_signal(purchase, utr="")
                run_reconciliation(purchase)
        except FractionalGoldPurchase.DoesNotExist:
            return Response(
                {"detail": "UPI order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        payload = _ser_purchase(purchase)
        payload["order_reference"] = purchase.order_reference
        payload["reconciliation_score"] = purchase.reconciliation_score
        return Response(payload)


class FractionalOrderPaymentSmsView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    """Ingest bank SMS text (Android listener or paste)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Customers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        data = request.data if isinstance(request.data, dict) else {}
        sms_text = str(data.get("sms_text") or "").strip()
        if not sms_text:
            return Response(
                {"detail": "sms_text is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        received_at = _parse_received_at(str(data.get("received_at") or ""))
        try:
            with transaction.atomic():
                purchase = FractionalGoldPurchase.objects.select_for_update().get(
                    pk=pk,
                    customer=request.user,
                    payment_method=FractionalGoldPurchase.PAY_UPI,
                )
                if purchase.status not in RECONCILABLE_STATUSES:
                    return Response(
                        {"detail": "Order is not awaiting payment."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if is_payment_expired(purchase):
                    return Response(
                        {"detail": "Payment window expired. Place a new order."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                sig = capture_sms_signal(
                    purchase, sms_text, received_at=received_at
                )
                if sig is None:
                    return Response(
                        {"detail": "Could not parse payment details from SMS."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if sig.utr:
                    from apps.accounts.services.fractional_upi import utr_already_used

                    if utr_already_used(sig.utr, exclude_purchase_id=purchase.pk):
                        return Response(
                            {"detail": "This UPI reference is already linked to another order."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                run_reconciliation(purchase)
        except FractionalGoldPurchase.DoesNotExist:
            return Response(
                {"detail": "UPI order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        payload = _ser_purchase(purchase)
        payload["order_reference"] = purchase.order_reference
        payload["reconciliation_score"] = purchase.reconciliation_score
        return Response(payload)


class JewellerFractionalPendingReconciliationView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        qs = (
            FractionalGoldPurchase.objects.filter(
                jeweller=request.user,
                payment_method=FractionalGoldPurchase.PAY_UPI,
                status__in=(
                    FractionalGoldPurchase.PENDING_REVIEW,
                    FractionalGoldPurchase.NEEDS_MANUAL_VERIFICATION,
                    FractionalGoldPurchase.AWAITING_UTR_VERIFY,
                ),
            )
            .select_related("customer")
            .order_by("-reconciliation_score", "-created_at")[:100]
        )
        high: list[dict] = []
        exceptions: list[dict] = []
        for p in qs:
            row = _enrich_purchase_row(p)
            if (p.reconciliation_score or 0) >= 60:
                high.append(row)
            else:
                exceptions.append(row)
        avg = 0
        if high:
            avg = sum(r.get("reconciliation_score") or 0 for r in high) // len(high)
        return Response(
            {
                "high_confidence": high,
                "exceptions": exceptions,
                "summary": {
                    "high_count": len(high),
                    "exception_count": len(exceptions),
                    "avg_score_high": avg,
                },
            }
        )


class JewellerFractionalBulkApproveView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        data = request.data if isinstance(request.data, dict) else {}
        try:
            min_score = int(data.get("min_score", 60))
        except (TypeError, ValueError):
            min_score = 60
        ids = data.get("ids")
        approved = 0
        with transaction.atomic():
            qs = FractionalGoldPurchase.objects.select_for_update().filter(
                jeweller=request.user,
                payment_method=FractionalGoldPurchase.PAY_UPI,
                status__in=(
                    FractionalGoldPurchase.PENDING_REVIEW,
                    FractionalGoldPurchase.NEEDS_MANUAL_VERIFICATION,
                    FractionalGoldPurchase.AWAITING_UTR_VERIFY,
                ),
            )
            if ids:
                qs = qs.filter(pk__in=ids)
            for purchase in qs:
                score = purchase.reconciliation_score or 0
                if score < min_score:
                    continue
                sig = capture_jeweller_confirmation_signal(purchase)
                confirm_fractional_purchase(
                    purchase,
                    by_user=request.user,
                    best_signal=sig,
                    decision="jeweller",
                )
                approved += 1
        return Response({"approved": approved})


class JewellerFractionalApproveView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            with transaction.atomic():
                purchase = FractionalGoldPurchase.objects.select_for_update().get(
                    pk=pk,
                    jeweller=request.user,
                    payment_method=FractionalGoldPurchase.PAY_UPI,
                )
                if purchase.status == FractionalGoldPurchase.COMPLETED:
                    return Response(_ser_purchase(purchase))
                if purchase.status not in (
                    FractionalGoldPurchase.PENDING_REVIEW,
                    FractionalGoldPurchase.NEEDS_MANUAL_VERIFICATION,
                    FractionalGoldPurchase.AWAITING_UTR_VERIFY,
                    FractionalGoldPurchase.SIGNAL_RECEIVED,
                ):
                    return Response(
                        {"detail": "Order is not awaiting approval."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                sig = capture_jeweller_confirmation_signal(purchase)
                confirm_fractional_purchase(
                    purchase,
                    by_user=request.user,
                    best_signal=sig,
                    decision="jeweller",
                )
        except FractionalGoldPurchase.DoesNotExist:
            return Response(
                {"detail": "Order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_ser_purchase(purchase))


class JewellerFractionalRejectView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Jewellers only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            with transaction.atomic():
                purchase = FractionalGoldPurchase.objects.select_for_update().get(
                    pk=pk,
                    jeweller=request.user,
                    payment_method=FractionalGoldPurchase.PAY_UPI,
                )
                if purchase.status == FractionalGoldPurchase.COMPLETED:
                    return Response(
                        {"detail": "Cannot reject a completed order."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                purchase.status = FractionalGoldPurchase.REJECTED
                purchase.save(update_fields=["status", "updated_at"])
        except FractionalGoldPurchase.DoesNotExist:
            return Response(
                {"detail": "Order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_ser_purchase(purchase))
