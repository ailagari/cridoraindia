from decimal import Decimal
import secrets
import string

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
    GoldDepositIntake,
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
from .services.festival_broadcast import process_due_festival_broadcasts
from .services.kyc_review import customer_in_review_queue, jeweller_in_review_queue
from .services.platform_operational import (
    fractional_counter_otp_ttl_seconds_int,
    fractional_markup_percent,
    set_fractional_counter_otp_ttl_seconds,
    set_fractional_markup_percent,
)
from .vault_service import jeweller_primary_customer_base_payload

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
        fractional_orders_pending_upi = FractionalGoldPurchase.objects.filter(
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status__in=(
                FractionalGoldPurchase.PENDING_PAYMENT,
                FractionalGoldPurchase.SIGNAL_RECEIVED,
                FractionalGoldPurchase.PENDING_REVIEW,
                FractionalGoldPurchase.NEEDS_MANUAL_VERIFICATION,
                FractionalGoldPurchase.AWAITING_UTR_VERIFY,
            ),
        ).count()
        fractional_orders_pending_review = FractionalGoldPurchase.objects.filter(
            status__in=(
                FractionalGoldPurchase.PENDING_REVIEW,
                FractionalGoldPurchase.NEEDS_MANUAL_VERIFICATION,
                FractionalGoldPurchase.AWAITING_UTR_VERIFY,
                FractionalGoldPurchase.SIGNAL_RECEIVED,
            ),
        ).count()
        fractional_orders_cancelled = FractionalGoldPurchase.objects.filter(
            status__in=(
                FractionalGoldPurchase.CANCELLED,
                FractionalGoldPurchase.REJECTED,
            ),
        ).count()
        fractional_orders_completed = FractionalGoldPurchase.objects.filter(
            status=FractionalGoldPurchase.COMPLETED,
        ).count()

        gold_deposit_pending_otp = GoldDepositIntake.objects.filter(
            status=GoldDepositIntake.AWAITING_CUSTOMER_OTP,
        ).count()
        gold_deposit_completed = GoldDepositIntake.objects.filter(
            status=GoldDepositIntake.COMPLETED,
        ).count()
        recent_gold_deposits = [
            {
                "id": d.id,
                "reference": f"GD-{d.id}",
                "status": d.status,
                "grams": str(d.grams),
                "customer_email": d.customer.email,
                "customer_member_id": d.customer.cridora_member_id or "",
                "jeweller_business": d.jeweller.business_name or d.jeweller.email or "",
                "created_at": d.created_at.isoformat(),
            }
            for d in GoldDepositIntake.objects.select_related("customer", "jeweller").order_by(
                "-created_at"
            )[:12]
        ]
        recent_fractional_orders = [
            {
                "id": p.id,
                "reference": f"FR-{p.id}",
                "order_reference": p.order_reference,
                "status": p.status,
                "payment_method": p.payment_method,
                "grams": str(p.grams),
                "total_inr": str(p.total_inr),
                "upi_utr": p.upi_utr or "",
                "reconciliation_score": p.reconciliation_score,
                "customer_email": p.customer.email,
                "customer_member_id": p.customer.cridora_member_id or "",
                "jeweller_business": p.jeweller.business_name or p.jeweller.email or "",
                "created_at": p.created_at.isoformat(),
            }
            for p in FractionalGoldPurchase.objects.select_related("customer", "jeweller").order_by(
                "-created_at"
            )[:20]
        ]

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
                    "fractional_orders_pending_upi": fractional_orders_pending_upi,
                    "fractional_orders_pending_review": fractional_orders_pending_review,
                    "fractional_orders_cancelled": fractional_orders_cancelled,
                    "fractional_orders_completed": fractional_orders_completed,
                    "gold_deposit_pending_otp": gold_deposit_pending_otp,
                    "gold_deposit_completed": gold_deposit_completed,
                    "ledger_note": (
                        "Vault fractional holdings total only fractional grams; deposit and scheme vault "
                        "lines sit in per-customer views. Jeweller liability includes fractional purchases, "
                        "gold deposits after OTP verify, net of completed sellbacks."
                    ),
                },
                "kyc_queue": kyc_queue,
                "kyb_queue": kyb_queue,
                "payments": payments,
                "transactions": transactions,
                "recent_users": recent_users,
                "recent_gold_deposits": recent_gold_deposits,
                "recent_fractional_orders": recent_fractional_orders,
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


class AdminJewellerPrimaryCustomersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        err = _require_admin(request)
        if err:
            return err
        try:
            jeweller = User.objects.get(pk=user_id, user_type=User.JEWELLER)
        except User.DoesNotExist:
            return Response(
                {"detail": "Jeweller not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        rows = jeweller_primary_customer_base_payload(jeweller)
        total_g = sum(Decimal(r["vault_total_grams"]) for r in rows)
        est_inr = sum(
            Decimal(r["estimated_total_vault_value_inr"] or "0") for r in rows
        )
        return Response(
            {
                "results": rows,
                "primary_customer_count": len(rows),
                "primary_vault_grams_total": str(total_g),
                "primary_estimated_value_inr_total": str(est_inr.quantize(Decimal("0.01"))),
            }
        )


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
            from apps.accounts.services.jeweller_referral import ensure_jeweller_referral_code

            ensure_jeweller_referral_code(user)
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

        from apps.accounts.services.notification_ack import admin_compliance_unread_queryset

        process_due_festival_broadcasts()

        rows = list(admin_compliance_unread_queryset(request.user).order_by("-created_at")[:limit])
        ser = AdminNotificationSerializer(
            rows,
            many=True,
            context={"request": request, "read_ids": set()},
        )
        return Response({"results": ser.data, "unread_in_feed": len(rows)})


class AdminNotificationsMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.accounts.services.notification_ack import ack_shared_admin_notifications

        err = _require_admin(request)
        if err:
            return err
        mark_all = bool(request.data.get("all"))
        ids = request.data.get("notification_ids")
        if not mark_all and not (isinstance(ids, list) and ids):
            return Response(
                {"detail": "Provide notification_ids (array) or all=true."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        id_list = None
        if isinstance(ids, list):
            id_list = []
            for x in ids[:200]:
                try:
                    id_list.append(int(x))
                except (TypeError, ValueError):
                    continue
        deleted = ack_shared_admin_notifications(
            request.user,
            notification_ids=id_list,
            mark_all=mark_all,
            exclude_festival=True,
        )
        return Response({"ok": True, "deleted": deleted})


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


def _generate_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _blacklist_user_refresh_tokens(user: User) -> None:
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    for outstanding in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=outstanding)


class AdminResetPasswordView(APIView):
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
        if user_is_platform_admin(user):
            return Response(
                {"detail": "Cannot reset admin account passwords."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        temp_password = _generate_temporary_password()
        user.set_password(temp_password)
        user.save(update_fields=["password"])
        _blacklist_user_refresh_tokens(user)
        return Response(
            {
                "detail": "Password reset.",
                "temporary_password": temp_password,
            }
        )


class AdminFractionalCounterOtpPolicyView(APIView):
    permission_classes = [IsAuthenticated]

    def _policy_payload(self) -> dict:
        row = PlatformOperationalSettings.objects.filter(pk=1).first()
        secs = row.fractional_counter_otp_ttl_seconds if row else 900
        markup = row.fractional_markup_percent if row else Decimal("0")
        return {
            "fractional_counter_otp_ttl_seconds": secs,
            "fractional_markup_percent": str(markup),
        }

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        return Response(self._policy_payload())

    def patch(self, request):
        err = _require_admin(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        out = self._policy_payload()

        if "fractional_counter_otp_ttl_seconds" in data:
            raw = data.get("fractional_counter_otp_ttl_seconds")
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
            out["fractional_counter_otp_ttl_seconds"] = fractional_counter_otp_ttl_seconds_int()

        if "fractional_markup_percent" in data:
            raw = data.get("fractional_markup_percent")
            try:
                set_fractional_markup_percent(raw)
            except (TypeError, ValueError, ArithmeticError):
                return Response(
                    {"detail": "fractional_markup_percent must be a number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except ValueError as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            out["fractional_markup_percent"] = str(fractional_markup_percent())

        return Response(out)
