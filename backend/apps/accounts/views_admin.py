from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model

from .models import (
    AdminNotification,
    AdminNotificationRead,
    BankAccount,
    FractionalGoldPurchase,
    JewellerLiabilityBalance,
    KYDocument,
    PlatformOperationalSettings,
    VaultHolding,
)
from .serializers import (
    AdminNotificationSerializer,
    AdminUserInspectProfileSerializer,
    BankAccountSerializer,
    KYDocumentReadSerializer,
    UserMeSerializer,
)
from .services.admin_access import user_is_platform_admin
from .services.kyc_review import customer_in_review_queue, jeweller_in_review_queue
from .services.platform_operational import (
    fractional_counter_otp_ttl_seconds_int,
    set_fractional_counter_otp_ttl_seconds,
)

User = get_user_model()


def _require_admin(request):
    if not user_is_platform_admin(request.user):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _user_summary(u: User) -> dict:
    row = {
        "id": u.id,
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "user_type": u.user_type,
        "kyc_status": u.kyc_status,
        "is_active": u.is_active,
        "joined": str(u.date_joined)[:10],
        "phone": u.phone,
    }
    if u.user_type == User.JEWELLER:
        row["business_name"] = u.business_name
        row["gstin"] = u.gstin
        row["city"] = u.city
    if u.user_type == User.CUSTOMER:
        try:
            row["bank_status"] = u.bank_account.status
        except BankAccount.DoesNotExist:
            row["bank_status"] = None
        doc_types = list(u.kyc_documents.values_list("doc_type", flat=True))
        row["documents_uploaded"] = sorted(set(doc_types))
        row["can_approve_kyc"] = u.kyc_status in (
            User.KYC_PENDING,
            User.KYC_REJECTED,
        )
    if u.user_type == User.JEWELLER:
        doc_types = list(u.kyc_documents.values_list("doc_type", flat=True))
        row["documents_uploaded"] = sorted(set(doc_types))
        row["can_approve_kyb"] = u.kyc_status in (
            User.KYC_PENDING,
            User.KYC_REJECTED,
        )
    return row


class AdminOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err

        total_users = User.objects.count()
        customers = User.objects.filter(user_type=User.CUSTOMER)
        jewellers = User.objects.filter(user_type=User.JEWELLER)
        pending_customers = customers.filter(kyc_status=User.KYC_PENDING).count()
        pending_jewellers = jewellers.filter(kyc_status=User.KYC_PENDING).count()

        kyc_queue_ids = []
        for u in (
            User.objects.filter(user_type=User.CUSTOMER)
            .prefetch_related("kyc_documents")
        ):
            if customer_in_review_queue(u):
                kyc_queue_ids.append(u.id)

        kyb_queue_ids = []
        for u in User.objects.filter(user_type=User.JEWELLER).prefetch_related(
            "kyc_documents"
        ):
            if jeweller_in_review_queue(u):
                kyb_queue_ids.append(u.id)

        kyc_queue = [
            _user_summary(u)
            for u in User.objects.filter(id__in=kyc_queue_ids).order_by("id")
        ]
        kyb_queue = [
            _user_summary(u)
            for u in User.objects.filter(id__in=kyb_queue_ids).order_by("id")
        ]

        recent_users = [
            _user_summary(u)
            for u in User.objects.order_by("-date_joined")[:12]
        ]

        payments = []
        transactions = []

        cust_hold_agg = VaultHolding.objects.filter(holding_type=VaultHolding.FRACTIONAL).aggregate(
            t=Sum("balance_grams")
        )["t"]
        customer_fractional_grams_total = str(cust_hold_agg or Decimal("0"))

        liab_agg = JewellerLiabilityBalance.objects.aggregate(t=Sum("liability_grams"))["t"]
        jeweller_custodial_liability_grams_total = str(liab_agg or Decimal("0"))

        fractional_orders_pending_counter = FractionalGoldPurchase.objects.filter(
            status=FractionalGoldPurchase.AWAITING_COUNTER,
        ).count()
        fractional_orders_completed = FractionalGoldPurchase.objects.filter(
            status=FractionalGoldPurchase.COMPLETED,
        ).count()

        return Response(
            {
                "stats": {
                    "total_users": total_users,
                    "total_customers": customers.count(),
                    "total_jewellers": jewellers.count(),
                    "pending_kyc_identity": pending_customers,
                    "pending_kyb_identity": pending_jewellers,
                    "kyc_review_queue_count": len(kyc_queue),
                    "kyb_review_queue_count": len(kyb_queue),
                    "payments_tracked_inr": None,
                    "customer_fractional_grams_total": customer_fractional_grams_total,
                    "jeweller_custodial_liability_grams_total": jeweller_custodial_liability_grams_total,
                    "fractional_orders_pending_counter": fractional_orders_pending_counter,
                    "fractional_orders_completed": fractional_orders_completed,
                    "ledger_note": (
                        "Vault fractional holdings and jeweller custodial liability aggregates reflect "
                        "completed fractional flows (counter OTP / legacy UPI confirm)."
                    ),
                },
                "kyc_queue": kyc_queue,
                "kyb_queue": kyb_queue,
                "payments": payments,
                "transactions": transactions,
                "recent_users": recent_users,
            }
        )


class AdminUserDocumentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        err = _require_admin(request)
        if err:
            return err
        try:
            u = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND
            )
        docs = KYDocument.objects.filter(user=u)
        payload = KYDocumentReadSerializer(
            docs, many=True, context={"request": request}
        ).data

        bank = None
        if u.user_type == User.CUSTOMER:
            try:
                bank = BankAccountSerializer(u.bank_account).data
            except BankAccount.DoesNotExist:
                bank = None

        profile = AdminUserInspectProfileSerializer(u).data

        return Response({"profile": profile, "documents": payload, "bank": bank})


class AdminCustomerKYCActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id, action):
        err = _require_admin(request)
        if err:
            return err
        if action not in ("approve", "reject"):
            return Response(
                {"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            user = User.objects.get(pk=user_id, user_type=User.CUSTOMER)
        except User.DoesNotExist:
            return Response(
                {"detail": "Customer not found."}, status=status.HTTP_404_NOT_FOUND
            )
        if action == "approve":
            if user.kyc_status == User.KYC_VERIFIED:
                return Response(
                    {"detail": "Customer is already verified."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            now = timezone.now()
            user.kyc_status = User.KYC_VERIFIED
            user.kyc_verified_at = now
            user.save(update_fields=["kyc_status", "kyc_verified_at"])
            KYDocument.objects.filter(user=user, status=KYDocument.DOC_PENDING).update(
                status=KYDocument.DOC_VERIFIED,
                reviewed_at=now,
                rejection_reason="",
            )
            try:
                ba = user.bank_account
                if ba.status == BankAccount.PENDING:
                    ba.status = BankAccount.VERIFIED
                    ba.save(update_fields=["status", "updated_at"])
            except BankAccount.DoesNotExist:
                pass
        else:
            reason = (request.data.get("reason") or "").strip()
            user.kyc_status = User.KYC_REJECTED
            user.kyc_verified_at = None
            user.save(update_fields=["kyc_status", "kyc_verified_at"])
            now = timezone.now()
            KYDocument.objects.filter(user=user).update(
                status=KYDocument.DOC_REJECTED,
                rejection_reason=reason,
                reviewed_at=now,
            )
        return Response(
            {
                "detail": f"KYC {action}d for {user.email}.",
                "kyc_status": user.kyc_status,
            }
        )


class AdminJewellerKYBActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id, action):
        err = _require_admin(request)
        if err:
            return err
        if action not in ("approve", "reject"):
            return Response(
                {"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            user = User.objects.get(pk=user_id, user_type=User.JEWELLER)
        except User.DoesNotExist:
            return Response(
                {"detail": "Jeweller not found."}, status=status.HTTP_404_NOT_FOUND
            )
        if action == "approve":
            if user.kyc_status == User.KYC_VERIFIED:
                return Response(
                    {"detail": "Jeweller is already verified."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            now = timezone.now()
            user.kyc_status = User.KYC_VERIFIED
            user.kyc_verified_at = now
            user.save(update_fields=["kyc_status", "kyc_verified_at"])
            KYDocument.objects.filter(user=user, status=KYDocument.DOC_PENDING).update(
                status=KYDocument.DOC_VERIFIED,
                reviewed_at=now,
                rejection_reason="",
            )
        else:
            reason = (request.data.get("reason") or "").strip()
            user.kyc_status = User.KYC_REJECTED
            user.kyc_verified_at = None
            user.save(update_fields=["kyc_status", "kyc_verified_at"])
            now = timezone.now()
            KYDocument.objects.filter(user=user).update(
                status=KYDocument.DOC_REJECTED,
                rejection_reason=reason,
                reviewed_at=now,
            )
        return Response(
            {
                "detail": f"KYB {action}d for {user.email}.",
                "kyc_status": user.kyc_status,
            }
        )


class AdminVerificationRevokeView(APIView):
    """Return customer/jeweller to pending review (drops public KYB visibility for jewellers)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        err = _require_admin(request)
        if err:
            return err
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND
            )
        if user.user_type not in (User.CUSTOMER, User.JEWELLER):
            return Response(
                {"detail": "Only customer or jeweller accounts can be revoked."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.kyc_status = User.KYC_PENDING
        user.kyc_verified_at = None
        user.save(update_fields=["kyc_status", "kyc_verified_at"])
        return Response(
            {
                "detail": "Verification revoked; account is pending review again.",
                "kyc_status": user.kyc_status,
            }
        )


class AdminDocumentRequestReuploadView(APIView):
    """Reject one document with reason and set account back to pending (jeweller drops public visibility)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, user_id, doc_id):
        err = _require_admin(request)
        if err:
            return err
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response(
                {"detail": "reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            doc = KYDocument.objects.select_related("user").get(
                pk=doc_id, user_id=user_id
            )
        except KYDocument.DoesNotExist:
            return Response(
                {"detail": "Document not found."}, status=status.HTTP_404_NOT_FOUND
            )
        target = doc.user
        if target.user_type not in (User.CUSTOMER, User.JEWELLER):
            return Response(
                {"detail": "Invalid account type for document review."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        now = timezone.now()
        doc.status = KYDocument.DOC_REJECTED
        doc.rejection_reason = reason
        doc.reviewed_at = now
        doc.save(update_fields=["status", "rejection_reason", "reviewed_at"])

        target.kyc_status = User.KYC_PENDING
        target.kyc_verified_at = None
        target.save(update_fields=["kyc_status", "kyc_verified_at"])

        return Response(
            {
                "detail": "Re-upload requested for this document.",
                "kyc_status": target.kyc_status,
                "document_id": doc.id,
            }
        )


class AdminNotificationsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        try:
            limit = int(request.query_params.get("limit") or 40)
        except ValueError:
            limit = 40
        limit = max(1, min(limit, 100))

        rows = list(AdminNotification.objects.all()[:limit])
        ids = [n.id for n in rows]
        read_ids = set(
            AdminNotificationRead.objects.filter(
                user=request.user, notification_id__in=ids
            ).values_list("notification_id", flat=True)
        )
        unread_in_feed = sum(1 for pk in ids if pk not in read_ids)
        ser = AdminNotificationSerializer(
            rows,
            many=True,
            context={"request": request, "read_ids": read_ids},
        )
        return Response({"results": ser.data, "unread_in_feed": unread_in_feed})


class AdminNotificationsMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        mark_all = bool(request.data.get("all"))
        ids = request.data.get("notification_ids")
        if mark_all:
            qs = AdminNotification.objects.all().order_by("-id")[:500]
        elif isinstance(ids, list) and ids:
            qs = AdminNotification.objects.filter(id__in=ids[:200])
        else:
            return Response(
                {"detail": "Provide notification_ids (array) or all=true."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for notif in qs.iterator(chunk_size=100):
            AdminNotificationRead.objects.get_or_create(
                user=request.user, notification=notif
            )
        return Response({"ok": True})


class AdminFreezeUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        err = _require_admin(request)
        if err:
            return err
        freeze = bool(request.data.get("freeze", True))
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND
            )
        if user_is_platform_admin(user):
            return Response(
                {"detail": "Cannot change admin accounts."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = not freeze
        user.save(update_fields=["is_active"])
        return Response(
            {
                "detail": "User updated.",
                "is_active": user.is_active,
            }
        )


class AdminFractionalCounterOtpPolicyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        row = PlatformOperationalSettings.objects.filter(pk=1).first()
        secs = row.fractional_counter_otp_ttl_seconds if row else 900
        return Response({"fractional_counter_otp_ttl_seconds": secs})

    def patch(self, request):
        err = _require_admin(request)
        if err:
            return err
        raw = request.data.get("fractional_counter_otp_ttl_seconds")
        try:
            val = int(raw)
        except (TypeError, ValueError):
            return Response(
                {"detail": "fractional_counter_otp_ttl_seconds must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            set_fractional_counter_otp_ttl_seconds(val)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"fractional_counter_otp_ttl_seconds": fractional_counter_otp_ttl_seconds_int()}
        )
