"""Jeweller scheme catalog, desk, and offering APIs."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Max, Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.platform_features import FeatureGatedViewMixin, require_feature_enabled
from apps.schemes.models import (
    CustomerSchemeEnrollment,
    JewellerSchemeOffering,
    SchemeContribution,
    SchemeCycleBonus,
    SchemeRedemption,
    SchemeRequest,
    SchemeTemplate,
)
from apps.schemes.scheme_counter_otp import verify_counter_otp
from apps.schemes.services.contribution_completion import (
    apply_bonus_confirmation,
    apply_contribution_completion,
)
from apps.schemes.services.contribution_service import (
    enrich_contribution_for_jeweller,
    serialize_contribution,
)
from apps.schemes.services.enrollment_service import (
    create_offering,
    jeweller_admit_customer,
    resolve_verified_customer,
    serialize_enrollment_for_jeweller,
    serialize_offering_brief,
)


def _require_jeweller(request):
    if request.user.user_type != User.JEWELLER:
        return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _serialize_catalog_template(t: SchemeTemplate) -> dict:
    return {
        "id": t.id,
        "slug": t.slug,
        "name": t.name,
        "description": t.description,
        "category": t.category,
        "icon_key": t.icon_key,
        "flow_summary": t.flow_summary,
        "scheme_design": t.scheme_design,
        "jeweller_can_override": (t.scheme_design or {}).get("jeweller_can_override", []),
    }


PENDING_UPI_STATUSES = (
    SchemeContribution.PENDING_REVIEW,
    SchemeContribution.NEEDS_MANUAL_VERIFICATION,
    SchemeContribution.AWAITING_UTR_VERIFY,
    SchemeContribution.PENDING_PAYMENT,
    SchemeContribution.SIGNAL_RECEIVED,
)


class JewellerSchemeCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        blocked = require_feature_enabled("golden_scheme")
        if blocked is not None:
            return blocked
        qs = SchemeTemplate.objects.filter(status=SchemeTemplate.STATUS_PUBLISHED).order_by(
            "sort_order", "name"
        )
        category = request.query_params.get("category")
        q = (request.query_params.get("q") or "").strip()
        if category:
            qs = qs.filter(category=category)
        if q:
            qs = qs.filter(name__icontains=q)
        return Response([_serialize_catalog_template(t) for t in qs])


class JewellerSchemeCatalogDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        err = _require_jeweller(request)
        if err:
            return err
        blocked = require_feature_enabled("golden_scheme")
        if blocked is not None:
            return blocked
        t = SchemeTemplate.objects.filter(
            pk=pk, status=SchemeTemplate.STATUS_PUBLISHED
        ).first()
        if not t:
            return Response({"detail": "Not found."}, status=404)
        return Response(_serialize_catalog_template(t))


class JewellerSchemeOfferingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        blocked = require_feature_enabled("golden_scheme")
        if blocked is not None:
            return blocked
        qs = JewellerSchemeOffering.objects.filter(jeweller=request.user).select_related(
            "scheme_template"
        )
        return Response([serialize_offering_brief(o) for o in qs])

    def post(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        blocked = require_feature_enabled("golden_scheme")
        if blocked is not None:
            return blocked
        template_id = request.data.get("template_id")
        if not template_id:
            return Response({"detail": "template_id is required."}, status=400)
        template = SchemeTemplate.objects.filter(
            pk=template_id, status=SchemeTemplate.STATUS_PUBLISHED
        ).first()
        if not template:
            return Response({"detail": "Published template not found."}, status=404)
        try:
            offering = create_offering(
                request.user,
                template,
                display_name=str(request.data.get("display_name") or ""),
                customer_facing_note=str(request.data.get("customer_facing_note") or ""),
                jeweller_overrides=request.data.get("jeweller_overrides") or {},
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(serialize_offering_brief(offering), status=201)


class JewellerSchemeOfferingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        err = _require_jeweller(request)
        if err:
            return err
        blocked = require_feature_enabled("golden_scheme")
        if blocked is not None:
            return blocked
        offering = JewellerSchemeOffering.objects.filter(
            pk=pk, jeweller=request.user
        ).select_related("scheme_template").first()
        if not offering:
            return Response({"detail": "Not found."}, status=404)
        if "status" in request.data:
            st = request.data["status"]
            if st in dict(JewellerSchemeOffering.STATUS_CHOICES):
                offering.status = st
                if st == JewellerSchemeOffering.STATUS_PAUSED:
                    offering.paused_at = timezone.now()
        if "display_name" in request.data:
            offering.display_name = request.data["display_name"]
        if "customer_facing_note" in request.data:
            offering.customer_facing_note = request.data["customer_facing_note"]
        if "jeweller_overrides" in request.data:
            allowed = set((offering.design_snapshot or {}).get("jeweller_can_override") or [])
            filtered = {
                k: v
                for k, v in (request.data["jeweller_overrides"] or {}).items()
                if k in allowed
            }
            offering.jeweller_overrides = {**offering.jeweller_overrides, **filtered}
        offering.save()
        return Response(serialize_offering_brief(offering))


class JewellerSchemeOfferingEnrollmentsView(APIView):
    """List and admit customers on a jeweller scheme offering."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        err = _require_jeweller(request)
        if err:
            return err
        blocked = require_feature_enabled("golden_scheme")
        if blocked is not None:
            return blocked
        offering = (
            JewellerSchemeOffering.objects.filter(pk=pk, jeweller=request.user)
            .select_related("scheme_template")
            .first()
        )
        if not offering:
            return Response({"detail": "Not found."}, status=404)
        status_filter = (request.query_params.get("status") or "").strip()
        qs = offering.enrollments.select_related("customer", "offering__jeweller")
        if status_filter:
            qs = qs.filter(status=status_filter)
        else:
            qs = qs.filter(
                status__in=(
                    CustomerSchemeEnrollment.STATUS_PENDING_ADMISSION,
                    CustomerSchemeEnrollment.STATUS_ACTIVE,
                    CustomerSchemeEnrollment.STATUS_PLAN_MONTH_COMPLETE,
                )
            )
        rows = [serialize_enrollment_for_jeweller(e) for e in qs.order_by("-started_at")]
        return Response(rows)

    def post(self, request, pk):
        err = _require_jeweller(request)
        if err:
            return err
        blocked = require_feature_enabled("golden_scheme")
        if blocked is not None:
            return blocked
        offering = (
            JewellerSchemeOffering.objects.filter(pk=pk, jeweller=request.user)
            .select_related("scheme_template")
            .first()
        )
        if not offering:
            return Response({"detail": "Not found."}, status=404)

        customer_id = request.data.get("customer_id")
        try:
            cid = int(customer_id) if customer_id is not None else None
        except (TypeError, ValueError):
            cid = None
        customer = resolve_verified_customer(
            customer_id=cid,
            cridora_member_id=str(request.data.get("cridora_member_id") or ""),
            phone=str(request.data.get("phone") or ""),
        )
        if not customer:
            return Response(
                {"detail": "Verified customer not found. Use Cridora ID or phone."},
                status=404,
            )
        try:
            enrollment = jeweller_admit_customer(request.user, offering, customer)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(serialize_enrollment_for_jeweller(enrollment), status=201)


class JewellerSchemeRequestCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        title = (request.data.get("title") or "").strip()
        if not title:
            return Response({"detail": "title is required."}, status=400)
        r = SchemeRequest.objects.create(
            jeweller=request.user,
            title=title,
            description=str(request.data.get("description") or ""),
            proposed_terms=request.data.get("proposed_terms") or {},
        )
        return Response({"id": r.id, "status": r.status}, status=201)


def _enrich_contribution_row(c: SchemeContribution) -> dict:
    row = enrich_contribution_for_jeweller(c)
    try:
        row["otp_expires_at"] = c.counter_otp.expires_at.isoformat()
    except Exception:
        row["otp_expires_at"] = None
    return row


JEWELLER_PENDING_CONTRIBUTION_STATUSES = (
    SchemeContribution.AWAITING_COUNTER,
    SchemeContribution.PENDING_PAYMENT,
    SchemeContribution.SIGNAL_RECEIVED,
    SchemeContribution.PENDING_REVIEW,
    SchemeContribution.NEEDS_MANUAL_VERIFICATION,
    SchemeContribution.AWAITING_UTR_VERIFY,
    SchemeContribution.PROOF_REJECTED,
    SchemeContribution.ON_HOLD,
)

JEWELLER_COMPLETED_CONTRIBUTION_STATUSES = (SchemeContribution.COMPLETED,)

JEWELLER_CANCELLED_CONTRIBUTION_STATUSES = (
    SchemeContribution.CANCELLED,
    SchemeContribution.REJECTED,
)

ONGOING_ENROLLMENT_STATUSES = (
    CustomerSchemeEnrollment.STATUS_PENDING_ADMISSION,
    CustomerSchemeEnrollment.STATUS_ACTIVE,
    CustomerSchemeEnrollment.STATUS_PLAN_MONTH_COMPLETE,
)

FINISHED_ENROLLMENT_STATUSES = (
    CustomerSchemeEnrollment.STATUS_REDEEMED,
    CustomerSchemeEnrollment.STATUS_CANCELLED,
    CustomerSchemeEnrollment.STATUS_DEFAULTED,
)


class JewellerSchemeContributionsLedgerView(APIView):
    """Payment ledger: pending, completed, and cancelled scheme deposits."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        blocked = require_feature_enabled("golden_scheme")
        if blocked is not None:
            return blocked

        base = SchemeContribution.objects.filter(
            enrollment__offering__jeweller=request.user,
        ).select_related(
            "enrollment__customer",
            "enrollment__offering__jeweller",
            "enrollment__offering__scheme_template",
            "counter_otp",
        )

        offering_id = request.query_params.get("offering_id")
        enrollment_id = request.query_params.get("enrollment_id")
        customer_id = request.query_params.get("customer_id")
        status_filter = (request.query_params.get("status") or "").strip()
        bucket = (request.query_params.get("bucket") or "").strip().lower()
        q = (request.query_params.get("q") or "").strip()

        if offering_id:
            base = base.filter(enrollment__offering_id=offering_id)
        if enrollment_id:
            base = base.filter(enrollment_id=enrollment_id)
        if customer_id:
            base = base.filter(enrollment__customer_id=customer_id)
        if status_filter:
            base = base.filter(status=status_filter)
        elif bucket == "pending":
            base = base.filter(status__in=JEWELLER_PENDING_CONTRIBUTION_STATUSES)
        elif bucket == "completed":
            base = base.filter(status__in=JEWELLER_COMPLETED_CONTRIBUTION_STATUSES)
        elif bucket == "cancelled":
            base = base.filter(status__in=JEWELLER_CANCELLED_CONTRIBUTION_STATUSES)

        if q:
            base = base.filter(
                Q(reference__icontains=q)
                | Q(upi_utr__icontains=q)
                | Q(enrollment__customer__cridora_member_id__icontains=q)
                | Q(enrollment__customer__email__icontains=q)
                | Q(enrollment__customer__first_name__icontains=q)
                | Q(enrollment__customer__last_name__icontains=q)
                | Q(enrollment__customer__phone__icontains=q)
            )

        pending_filter = base.filter(status__in=JEWELLER_PENDING_CONTRIBUTION_STATUSES)
        completed_filter = base.filter(status__in=JEWELLER_COMPLETED_CONTRIBUTION_STATUSES)
        cancelled_filter = base.filter(status__in=JEWELLER_CANCELLED_CONTRIBUTION_STATUSES)

        if bucket == "pending":
            rows_qs = pending_filter.order_by("-created_at")[:100]
            rows = [_enrich_contribution_row(c) for c in rows_qs]
        elif bucket == "completed":
            rows_qs = completed_filter.order_by("-jeweller_verified_at", "-created_at")[:100]
            rows = [_enrich_contribution_row(c) for c in rows_qs]
        elif bucket == "cancelled":
            rows_qs = cancelled_filter.order_by("-updated_at")[:100]
            rows = [_enrich_contribution_row(c) for c in rows_qs]
        else:
            rows = []

        return Response(
            {
                "results": rows,
                "summary": {
                    "pending_count": pending_filter.count(),
                    "completed_count": completed_filter.count(),
                    "cancelled_count": cancelled_filter.count(),
                    "pending_action_count": pending_filter.filter(
                        status__in=(
                            SchemeContribution.AWAITING_COUNTER,
                            SchemeContribution.PENDING_REVIEW,
                            SchemeContribution.NEEDS_MANUAL_VERIFICATION,
                            SchemeContribution.AWAITING_UTR_VERIFY,
                        )
                    ).count(),
                },
            }
        )


class JewellerSchemeEnrollmentsLedgerView(APIView):
    """Customer enrollments across all schemes — search and ongoing/finished filters."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        blocked = require_feature_enabled("golden_scheme")
        if blocked is not None:
            return blocked

        qs = (
            CustomerSchemeEnrollment.objects.filter(offering__jeweller=request.user)
            .select_related("customer", "offering__scheme_template")
            .annotate(
                deposit_count=Count("contributions"),
                completed_deposit_count=Count(
                    "contributions",
                    filter=Q(contributions__status=SchemeContribution.COMPLETED),
                ),
                total_deposited_inr=Sum(
                    "contributions__amount_inr",
                    filter=Q(contributions__status=SchemeContribution.COMPLETED),
                ),
                last_deposit_at=Max("contributions__created_at"),
            )
        )

        offering_id = request.query_params.get("offering_id")
        bucket = (request.query_params.get("bucket") or "").strip().lower()
        status_filter = (request.query_params.get("status") or "").strip()
        q = (request.query_params.get("q") or "").strip()

        if offering_id:
            qs = qs.filter(offering_id=offering_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        elif bucket == "ongoing":
            qs = qs.filter(status__in=ONGOING_ENROLLMENT_STATUSES)
        elif bucket == "finished":
            qs = qs.filter(status__in=FINISHED_ENROLLMENT_STATUSES)

        if q:
            qs = qs.filter(
                Q(customer__cridora_member_id__icontains=q)
                | Q(customer__email__icontains=q)
                | Q(customer__first_name__icontains=q)
                | Q(customer__last_name__icontains=q)
                | Q(customer__phone__icontains=q)
                | Q(offering__display_name__icontains=q)
            )

        ongoing_filter = qs.filter(status__in=ONGOING_ENROLLMENT_STATUSES)
        finished_filter = qs.filter(status__in=FINISHED_ENROLLMENT_STATUSES)
        pending_admission_filter = qs.filter(
            status=CustomerSchemeEnrollment.STATUS_PENDING_ADMISSION
        )

        rows = []
        for e in qs.order_by("-started_at")[:100]:
            row = serialize_enrollment_for_jeweller(e)
            row["deposit_count"] = int(getattr(e, "deposit_count", 0) or 0)
            row["completed_deposit_count"] = int(
                getattr(e, "completed_deposit_count", 0) or 0
            )
            total = getattr(e, "total_deposited_inr", None)
            row["total_deposited_inr"] = str(total) if total is not None else "0.00"
            last = getattr(e, "last_deposit_at", None)
            row["last_deposit_at"] = last.isoformat() if last else None
            rows.append(row)

        return Response(
            {
                "results": rows,
                "summary": {
                    "ongoing_count": ongoing_filter.count(),
                    "finished_count": finished_filter.count(),
                    "pending_admission_count": pending_admission_filter.count(),
                },
            }
        )


class JewellerSchemeContributionsPendingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        qs = (
            SchemeContribution.objects.filter(
                enrollment__offering__jeweller=request.user,
                status=SchemeContribution.AWAITING_COUNTER,
            )
            .select_related("enrollment__customer", "counter_otp")
            .order_by("-created_at")[:100]
        )
        out = []
        for c in qs:
            row = _enrich_contribution_row(c)
            try:
                row["otp_expires_at"] = c.counter_otp.expires_at.isoformat()
            except Exception:
                row["otp_expires_at"] = None
            out.append(row)
        return Response({"results": out})


class JewellerSchemeContributionsPendingUpiView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        qs = (
            SchemeContribution.objects.filter(
                enrollment__offering__jeweller=request.user,
                payment_method=SchemeContribution.PAY_UPI,
                status__in=PENDING_UPI_STATUSES,
            )
            .select_related("enrollment__customer")
            .order_by("-created_at")[:100]
        )
        return Response({"results": [_enrich_contribution_row(c) for c in qs]})


class JewellerSchemeContributionsPendingReconciliationView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        qs = (
            SchemeContribution.objects.filter(
                enrollment__offering__jeweller=request.user,
                payment_method=SchemeContribution.PAY_UPI,
                status__in=(
                    SchemeContribution.PENDING_REVIEW,
                    SchemeContribution.NEEDS_MANUAL_VERIFICATION,
                ),
            )
            .select_related("enrollment__customer")
            .order_by("-created_at")[:100]
        )
        out = []
        for c in qs:
            row = _enrich_contribution_row(c)
            row["reconciliation_score"] = c.reconciliation_score
            row["reconciliation_flags"] = c.reconciliation_flags or {}
            out.append(row)
        return Response({"results": out})


class JewellerSchemeContributionVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_jeweller(request)
        if err:
            return err
        raw_otp = (request.data or {}).get("otp") or ""
        try:
            with transaction.atomic():
                contribution = SchemeContribution.objects.select_for_update().get(
                    pk=pk,
                    enrollment__offering__jeweller=request.user,
                    status=SchemeContribution.AWAITING_COUNTER,
                )
                ok, detail = verify_counter_otp(contribution, str(raw_otp))
                if not ok:
                    return Response({"detail": detail}, status=400)
                contribution.confirmed_by = request.user
                contribution.jeweller_verified_at = timezone.now()
                contribution.save(
                    update_fields=["confirmed_by", "jeweller_verified_at", "updated_at"]
                )
                apply_contribution_completion(contribution)
        except SchemeContribution.DoesNotExist:
            return Response({"detail": "Pending counter contribution not found."}, status=404)
        return Response(serialize_contribution(contribution))


class JewellerSchemeContributionApproveView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_jeweller(request)
        if err:
            return err
        try:
            with transaction.atomic():
                contribution = SchemeContribution.objects.select_for_update().get(
                    pk=pk,
                    enrollment__offering__jeweller=request.user,
                    payment_method=SchemeContribution.PAY_UPI,
                )
                if contribution.status == SchemeContribution.COMPLETED:
                    return Response(serialize_contribution(contribution))
                if contribution.status != SchemeContribution.PENDING_REVIEW:
                    return Response(
                        {"detail": "Contribution is not awaiting approval."},
                        status=400,
                    )
                contribution.confirmed_by = request.user
                contribution.jeweller_verified_at = timezone.now()
                contribution.reconciled_at = timezone.now()
                contribution.save(
                    update_fields=[
                        "confirmed_by",
                        "jeweller_verified_at",
                        "reconciled_at",
                        "updated_at",
                    ]
                )
                apply_contribution_completion(contribution)
        except SchemeContribution.DoesNotExist:
            return Response({"detail": "Contribution not found."}, status=404)
        return Response(serialize_contribution(contribution))


class JewellerSchemeContributionRejectView(FeatureGatedViewMixin, APIView):
    feature_key = "fractional_upi_reconciliation"
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_jeweller(request)
        if err:
            return err
        try:
            with transaction.atomic():
                contribution = SchemeContribution.objects.select_for_update().get(
                    pk=pk,
                    enrollment__offering__jeweller=request.user,
                    payment_method=SchemeContribution.PAY_UPI,
                )
                if contribution.status == SchemeContribution.COMPLETED:
                    return Response(
                        {"detail": "Cannot reject a completed contribution."},
                        status=400,
                    )
                contribution.status = SchemeContribution.REJECTED
                contribution.save(update_fields=["status", "updated_at"])
        except SchemeContribution.DoesNotExist:
            return Response({"detail": "Contribution not found."}, status=404)
        return Response(serialize_contribution(contribution))


class JewellerSchemeConfirmBonusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        err = _require_jeweller(request)
        if err:
            return err
        bonus = (
            SchemeCycleBonus.objects.filter(
                pk=pk,
                enrollment__offering__jeweller=request.user,
                status=SchemeCycleBonus.STATUS_PENDING,
            )
            .select_related("enrollment")
            .first()
        )
        if not bonus:
            return Response({"detail": "Pending bonus not found."}, status=404)
        with transaction.atomic():
            apply_bonus_confirmation(bonus, confirmed_by=request.user)
        return Response(
            {
                "id": bonus.id,
                "status": bonus.status,
                "amount_inr": str(bonus.amount_inr),
                "credit_as": bonus.credit_as,
            }
        )


class JewellerSchemeRedemptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_jeweller(request)
        if err:
            return err
        qs = (
            SchemeRedemption.objects.filter(enrollment__offering__jeweller=request.user)
            .select_related("enrollment__customer")
            .order_by("-created_at")[:100]
        )
        return Response(
            [
                {
                    "id": r.id,
                    "status": r.status,
                    "redeem_as": r.redeem_as,
                    "amount_inr_from_pool": str(r.amount_inr_from_pool),
                    "gold_grams_debited": str(r.gold_grams_debited),
                    "customer_email": r.enrollment.customer.email,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                }
                for r in qs
            ]
        )
