from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

from .models import BankAccount, KYDocument
from .services.admin_access import sync_staff_superuser_to_platform_admin
from .serializers import (
    BankAccountSerializer,
    CustomerPersonalProfileSerializer,
    CustomerRegisterSerializer,
    JewellerApplySerializer,
    JewellerBusinessProfileSerializer,
    KYDocumentReadSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    UserMeSerializer,
    user_auth_payload,
)

User = get_user_model()


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        user = ser.validated_data["user"]
        user = sync_staff_superuser_to_platform_admin(user)
        return Response(user_auth_payload(user), status=status.HTTP_200_OK)


class CustomerRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = CustomerRegisterSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        user = ser.save()
        return Response(user_auth_payload(user), status=status.HTTP_201_CREATED)


class JewellerApplyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = JewellerApplySerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        user = ser.save()
        return Response(user_auth_payload(user), status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = UserMeSerializer(request.user, context={"request": request}).data
        return Response(data)


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = PasswordChangeSerializer(data=request.data, context={"request": request})
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        user.set_password(ser.validated_data["new_password"])
        user.save(update_fields=["password"])
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass
        return Response(user_auth_payload(user))


class CustomerPersonalProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Only customers can update personal profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        ser = CustomerPersonalProfileSerializer(data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        if not ser.validated_data:
            return Response(
                UserMeSerializer(request.user, context={"request": request}).data
            )
        u = request.user
        fields_to_update: list[str] = []
        for key in ("first_name", "last_name", "phone"):
            if key not in ser.validated_data:
                continue
            setattr(u, key, (ser.validated_data[key] or "").strip())
            fields_to_update.append(key)
        if fields_to_update:
            u.save(update_fields=fields_to_update)
        return Response(UserMeSerializer(u, context={"request": request}).data)


class JewellerBusinessProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response(
                {"detail": "Only jewellers can update business profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        ser = JewellerBusinessProfileSerializer(data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        if not ser.validated_data:
            return Response(
                UserMeSerializer(request.user, context={"request": request}).data
            )
        u = request.user
        fields_to_update: list[str] = []
        mapping = {
            "business_name": lambda x: (x or "").strip(),
            "gstin": lambda x: (x or "").strip().upper(),
            "shop_address": lambda x: (x or "").strip(),
            "city": lambda x: (x or "").strip(),
            "state": lambda x: (x or "").strip(),
            "pincode": lambda x: (x or "").strip(),
        }
        for key, normalize in mapping.items():
            if key not in ser.validated_data:
                continue
            setattr(u, key, normalize(ser.validated_data[key]))
            fields_to_update.append(key)
        if fields_to_update:
            u.save(update_fields=fields_to_update)
        data = UserMeSerializer(u, context={"request": request}).data
        return Response(data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        body = request.data
        refresh_token = body.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass
        return Response({"detail": "Logged out successfully."})


class BankAccountUpsertView(APIView):
    """Customer bank details for KYC."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response(
                {"detail": "Only customers add bank KYC here."},
                status=status.HTTP_403_FORBIDDEN,
            )
        ser = BankAccountSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            BankAccount.objects.update_or_create(
                user=request.user,
                defaults={
                    "account_holder_name": ser.validated_data["account_holder_name"],
                    "account_number": ser.validated_data["account_number"],
                    "ifsc_code": ser.validated_data["ifsc_code"].strip().upper(),
                    "bank_name": ser.validated_data.get("bank_name", ""),
                    "branch": ser.validated_data.get("branch", ""),
                    "status": BankAccount.PENDING,
                },
            )
        acc = BankAccount.objects.get(user=request.user)
        return Response(
            BankAccountSerializer(acc).data, status=status.HTTP_200_OK
        )


class KYDocumentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = request.user.kyc_documents.all()
        return Response(
            KYDocumentReadSerializer(
                qs, many=True, context={"request": request}
            ).data
        )


class KYDocumentUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        doc_type = (request.data.get("doc_type") or "").strip()
        upload = request.FILES.get("file")
        if not doc_type or not upload:
            return Response(
                {"detail": "doc_type and file are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        allowed = set()
        if request.user.user_type == User.CUSTOMER:
            allowed = set(KYDocument.CUSTOMER_DOC_TYPES)
        elif request.user.user_type == User.JEWELLER:
            allowed = set(KYDocument.JEWELLER_DOC_TYPES)
        else:
            return Response(
                {"detail": "Invalid user type for document upload."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if doc_type not in allowed:
            return Response(
                {"detail": f"doc_type must be one of: {sorted(allowed)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj, _created = KYDocument.objects.get_or_create(
            user=request.user,
            doc_type=doc_type,
            defaults={
                "original_filename": getattr(upload, "name", "") or "",
            },
        )
        obj.file = upload
        obj.original_filename = getattr(upload, "name", "") or ""
        obj.status = KYDocument.DOC_PENDING
        obj.rejection_reason = ""
        obj.reviewed_at = None
        obj.save()
        if request.user.kyc_status == User.KYC_VERIFIED:
            request.user.kyc_status = User.KYC_PENDING
            request.user.kyc_verified_at = None
            request.user.save(update_fields=["kyc_status", "kyc_verified_at"])

        return Response(
            KYDocumentReadSerializer(obj, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


# Fix typo: User.kYC_VERIFIED -> User.KYC_VERIFIED in views
