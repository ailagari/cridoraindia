"""Customer-facing scheme APIs."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.platform_features import require_feature_enabled
from apps.schemes.models import (
    CustomerSchemeEnrollment,
    JewellerSchemeOffering,
    SchemeContribution,
)
from apps.schemes.scheme_counter_otp import issue_counter_otp
from apps.schemes.services.contribution_service import (
    create_contribution,
    quote_contribution,
    serialize_contribution,
)
from apps.schemes.services.enrollment_service import (
    enroll_customer,
    serialize_enrollment,
    serialize_offering_brief,
)
from apps.schemes.services.redemption_service import confirm_redemption, quote_redemption
from apps.schemes.services.scheme_upi import payment_payload_for, submit_utr

UserModel = get_user_model()


def _require_customer(request):
    if request.user.user_type != User.CUSTOMER:
        return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
    blocked = require_feature_enabled("golden_scheme")
    if blocked is not None:
        return blocked
    return None


class CustomerSchemeOfferingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_customer(request)
        if err:
            return err
        jeweller_id = request.query_params.get("jeweller_id")
        if not jeweller_id:
            return Response({"detail": "jeweller_id is required."}, status=400)
        qs = JewellerSchemeOffering.objects.filter(
            jeweller_id=jeweller_id,
            status=JewellerSchemeOffering.STATUS_ACTIVE,
        ).select_related("scheme_template", "jeweller")
        return Response([serialize_offering_brief(o) for o in qs])


class CustomerSchemeEnrollmentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_customer(request)
        if err:
            return err
        qs = (
            CustomerSchemeEnrollment.objects.filter(customer=request.user)
            .select_related("offering__scheme_template", "offering__jeweller")
            .order_by("-started_at")
        )
        st = request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        return Response([serialize_enrollment(e) for e in qs])

    def post(self, request):
        err = _require_customer(request)
        if err:
            return err
        offering_id = request.data.get("offering_id")
        if not offering_id:
            return Response({"detail": "offering_id is required."}, status=400)
        offering = (
            JewellerSchemeOffering.objects.filter(pk=offering_id)
            .select_related("scheme_template", "jeweller")
            .first()
        )
        if not offering:
            return Response({"detail": "Offering not found."}, status=404)
        try:
            enrollment = enroll_customer(request.user, offering)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(serialize_enrollment(enrollment), status=201)


class CustomerSchemeEnrollmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        err = _require_customer(request)
        if err:
            return err
        enrollment = (
            CustomerSchemeEnrollment.objects.filter(pk=pk, customer=request.user)
            .select_related("offering__scheme_template", "offering__jeweller")
            .first()
        )
        if not enrollment:
            return Response({"detail": "Not found."}, status=404)
        return Response(serialize_enrollment(enrollment))


class CustomerSchemeContributionQuoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_customer(request)
        if err:
            return err
        enrollment_id = request.data.get("enrollment_id")
        amount = request.data.get("amount_inr")
        if not enrollment_id or amount is None:
            return Response(
                {"detail": "enrollment_id and amount_inr are required."},
                status=400,
            )
        enrollment = CustomerSchemeEnrollment.objects.filter(
            pk=enrollment_id,
            customer=request.user,
            status=CustomerSchemeEnrollment.STATUS_ACTIVE,
        ).first()
        if not enrollment:
            return Response({"detail": "Active enrollment not found."}, status=404)
        try:
            total = Decimal(str(amount))
            quote = quote_contribution(enrollment, total)
        except (InvalidOperation, ValueError) as e:
            return Response({"detail": str(e)}, status=400)
        return Response(quote)


class CustomerSchemeContributionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_customer(request)
        if err:
            return err
        enrollment_id = request.data.get("enrollment_id")
        amount = request.data.get("amount_inr")
        payment_method = (request.data.get("payment_method") or "").strip().lower()
        if not enrollment_id or amount is None or payment_method not in (
            SchemeContribution.PAY_UPI,
            SchemeContribution.PAY_COUNTER,
        ):
            return Response(
                {"detail": "enrollment_id, amount_inr, and payment_method required."},
                status=400,
            )
        enrollment = CustomerSchemeEnrollment.objects.filter(
            pk=enrollment_id,
            customer=request.user,
            status=CustomerSchemeEnrollment.STATUS_ACTIVE,
        ).first()
        if not enrollment:
            return Response({"detail": "Active enrollment not found."}, status=404)
        try:
            contribution = create_contribution(
                enrollment,
                total_inr=Decimal(str(amount)),
                payment_method=payment_method,
                customer_note=str(request.data.get("customer_note") or ""),
            )
        except (InvalidOperation, ValueError) as e:
            return Response({"detail": str(e)}, status=400)
        return Response(serialize_contribution(contribution), status=201)


class CustomerSchemeContributionCounterOtpView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_customer(request)
        if err:
            return err
        blocked = require_feature_enabled("fractional_counter")
        if blocked is not None:
            return blocked
        try:
            with transaction.atomic():
                contribution = SchemeContribution.objects.select_for_update().get(
                    pk=pk,
                    enrollment__customer=request.user,
                )
                code, expires_at = issue_counter_otp(contribution)
        except SchemeContribution.DoesNotExist:
            return Response({"detail": "Contribution not found."}, status=404)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        payload = serialize_contribution(contribution)
        payload["otp"] = code
        payload["otp_expires_at"] = expires_at.isoformat()
        payload["otp_ttl_seconds"] = max(
            0, int((expires_at - timezone.now()).total_seconds())
        )
        return Response(payload)


class CustomerSchemeContributionPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        err = _require_customer(request)
        if err:
            return err
        contribution = SchemeContribution.objects.filter(
            pk=pk,
            enrollment__customer=request.user,
            payment_method=SchemeContribution.PAY_UPI,
        ).select_related("enrollment__offering__jeweller").first()
        if not contribution:
            return Response({"detail": "UPI contribution not found."}, status=404)
        payload = serialize_contribution(contribution)
        payload["payment"] = payment_payload_for(contribution)
        return Response(payload)


class CustomerSchemeContributionSubmitUtrView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_customer(request)
        if err:
            return err
        raw_utr = str((request.data or {}).get("utr") or "")
        try:
            with transaction.atomic():
                contribution = SchemeContribution.objects.select_for_update().get(
                    pk=pk,
                    enrollment__customer=request.user,
                    payment_method=SchemeContribution.PAY_UPI,
                )
                ok, detail = submit_utr(contribution, raw_utr)
                if not ok:
                    return Response({"detail": detail}, status=400)
        except SchemeContribution.DoesNotExist:
            return Response({"detail": "Contribution not found."}, status=404)
        contribution.refresh_from_db()
        return Response(serialize_contribution(contribution))


class CustomerSchemeRedemptionQuoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_customer(request)
        if err:
            return err
        enrollment_id = request.data.get("enrollment_id")
        if not enrollment_id:
            return Response({"detail": "enrollment_id is required."}, status=400)
        enrollment = CustomerSchemeEnrollment.objects.filter(
            pk=enrollment_id,
            customer=request.user,
        ).first()
        if not enrollment:
            return Response({"detail": "Enrollment not found."}, status=404)
        try:
            quote = quote_redemption(
                enrollment,
                ornament_metal_inr=Decimal(str(request.data.get("ornament_metal_inr") or 0)),
                ornament_making_inr=Decimal(
                    str(request.data.get("ornament_making_inr") or 0)
                ),
            )
        except (InvalidOperation, ValueError) as e:
            return Response({"detail": str(e)}, status=400)
        return Response(quote)


class CustomerSchemeRedemptionConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_customer(request)
        if err:
            return err
        enrollment_id = request.data.get("enrollment_id")
        if not enrollment_id:
            return Response({"detail": "enrollment_id is required."}, status=400)
        enrollment = CustomerSchemeEnrollment.objects.filter(
            pk=enrollment_id,
            customer=request.user,
        ).first()
        if not enrollment:
            return Response({"detail": "Enrollment not found."}, status=404)
        try:
            quote = quote_redemption(enrollment)
            if not quote.get("can_redeem"):
                return Response({"detail": quote.get("detail", "Cannot redeem.")}, status=400)
            redemption = confirm_redemption(enrollment, quote)
        except (InvalidOperation, ValueError) as e:
            return Response({"detail": str(e)}, status=400)
        return Response(
            {
                "id": redemption.id,
                "status": redemption.status,
                "quote": quote,
            },
            status=201,
        )
