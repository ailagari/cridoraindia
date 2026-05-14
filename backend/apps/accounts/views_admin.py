from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model

from .models import BankAccount, KYDocument
from .serializers import BankAccountSerializer, KYDocumentReadSerializer, UserMeSerializer
from .services.kyc_review import customer_in_review_queue, jeweller_in_review_queue

User = get_user_model()


def _require_admin(request):
    if not request.user.is_authenticated or request.user.user_type != User.ADMIN:
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
                    "ledger_note": "Payments and ledger APIs will attach here when buy/sell models land.",
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

        profile = UserMeSerializer(u, context={"request": request}).data

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
        if user.user_type == User.ADMIN:
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
