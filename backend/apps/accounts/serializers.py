from django.conf import settings
from django.contrib.auth import get_user_model
from decimal import Decimal
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AdminNotification, AdminNotificationRead, BankAccount, KYDocument
from .vault_service import sync_customer_aggregate_balance, wallet_vault_payload

User = get_user_model()


def issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = (attrs.get("email") or "").lower().strip()
        password = attrs.get("password") or ""
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {"email": "Invalid email or password."}
            )
        if not user.check_password(password):
            raise serializers.ValidationError(
                {"password": "Invalid email or password."}
            )
        if not user.is_active:
            raise serializers.ValidationError(
                {"email": "Account is disabled."}
            )
        attrs["user"] = user
        return attrs


class CustomerRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value.strip()).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return value.lower().strip()

    def create(self, validated_data):
        email = validated_data["email"]
        return User.objects.create_user(
            username=email,
            email=email,
            password=validated_data["password"],
            first_name=validated_data.get("first_name", "").strip(),
            last_name=validated_data.get("last_name", "").strip(),
            phone=(validated_data.get("phone") or "").strip(),
            user_type=User.CUSTOMER,
        )


class JewellerApplySerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    business_name = serializers.CharField(max_length=255)
    gstin = serializers.CharField(max_length=15, required=False, allow_blank=True)
    shop_address = serializers.CharField(max_length=512)
    city = serializers.CharField(max_length=100)
    state = serializers.CharField(max_length=100)
    pincode = serializers.CharField(max_length=10)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value.strip()).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return value.lower().strip()

    def validate_gstin(self, value):
        v = (value or "").strip().upper()
        if not v:
            return ""
        if len(v) != 15:
            raise serializers.ValidationError(
                "GSTIN must be 15 characters (India format)."
            )
        return v

    def create(self, validated_data):
        email = validated_data["email"]
        gstin_val = (validated_data.get("gstin") or "").strip().upper()
        return User.objects.create_user(
            username=email,
            email=email,
            password=validated_data["password"],
            first_name=validated_data.get("first_name", "").strip(),
            last_name=validated_data.get("last_name", "").strip(),
            phone=(validated_data.get("phone") or "").strip(),
            user_type=User.JEWELLER,
            business_name=validated_data["business_name"].strip(),
            gstin=gstin_val,
            shop_address=validated_data["shop_address"].strip(),
            city=validated_data["city"].strip(),
            state=validated_data["state"].strip(),
            pincode=validated_data["pincode"].strip(),
        )


class JewellerBusinessProfileSerializer(serializers.Serializer):
    """Jeweller-only POST/PATCH for GSTIN and showroom identity after signup."""

    business_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    gstin = serializers.CharField(max_length=15, required=False, allow_blank=True)
    shop_address = serializers.CharField(max_length=512, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    pincode = serializers.CharField(max_length=10, required=False, allow_blank=True)

    def validate_gstin(self, value):
        v = (value or "").strip().upper()
        if not v:
            return ""
        if len(v) != 15:
            raise serializers.ValidationError(
                "GSTIN must be 15 characters (India format)."
            )
        return v


class AdminUserInspectProfileSerializer(serializers.ModelSerializer):
    """Scalar profile for admin inspect modal (no nested wallet/doc payloads)."""

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "user_type",
            "kyc_status",
            "kyc_verified_at",
            "date_joined",
            "is_active",
            "business_name",
            "gstin",
            "shop_address",
            "city",
            "state",
            "pincode",
            "jeweller_code",
            "cridora_member_id",
        )
        read_only_fields = fields


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = (
            "account_holder_name",
            "account_number",
            "ifsc_code",
            "bank_name",
            "branch",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("status", "created_at", "updated_at")


class KYDocumentReadSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = KYDocument
        fields = (
            "id",
            "doc_type",
            "file_url",
            "original_filename",
            "status",
            "rejection_reason",
            "uploaded_at",
            "reviewed_at",
        )
        read_only_fields = fields

    def get_file_url(self, obj):
        if not obj.file:
            return None
        relative = obj.file.url
        request = self.context.get("request")
        if request:
            try:
                return request.build_absolute_uri(relative)
            except Exception:
                pass
        base = getattr(settings, "DJANGO_PUBLIC_BASE_URL", "") or ""
        if base:
            return f"{base}{relative}" if relative.startswith("/") else f"{base}/{relative}"
        return relative


class UserMeSerializer(serializers.ModelSerializer):
    bank_account = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()
    gold_wallet = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "user_type",
            "phone",
            "kyc_status",
            "business_name",
            "gstin",
            "shop_address",
            "city",
            "state",
            "pincode",
            "cridora_member_id",
            "gold_upi",
            "gold_handle_local",
            "jeweller_code",
            "default_jeweller",
            "jeweller_pref_nearby",
            "jeweller_pref_ornament",
            "jeweller_pref_redemption",
            "bank_account",
            "documents",
            "gold_wallet",
        )
        read_only_fields = (
            "id",
            "email",
            "user_type",
            "kyc_status",
            "business_name",
            "gstin",
            "shop_address",
            "city",
            "state",
            "pincode",
            "cridora_member_id",
            "gold_upi",
            "gold_handle_local",
            "jeweller_code",
            "default_jeweller",
            "jeweller_pref_nearby",
            "jeweller_pref_ornament",
            "jeweller_pref_redemption",
            "bank_account",
            "documents",
            "gold_wallet",
        )

    def get_bank_account(self, obj):
        try:
            acc = obj.bank_account
        except BankAccount.DoesNotExist:
            return None
        return BankAccountSerializer(acc).data

    def get_documents(self, obj):
        qs = obj.kyc_documents.all()
        return KYDocumentReadSerializer(
            qs, many=True, context=self.context
        ).data

    def get_gold_wallet(self, obj):
        if obj.user_type not in (User.CUSTOMER, User.JEWELLER):
            return None
        if obj.user_type == User.CUSTOMER:
            sync_customer_aggregate_balance(obj)
        bal = getattr(obj, "gold_balance", None)
        grams = bal.balance_grams if bal else Decimal("0")
        handle = (obj.gold_handle_local or "").strip().lower()
        code = (obj.jeweller_code or "").strip().lower()
        data = {
            "cridora_member_id": obj.cridora_member_id or "",
            "cridora_global_id": f"{handle}@cridora" if handle else "",
            "merchant_cridora_id": f"{code}@cridora" if code else "",
            "gold_upi": obj.gold_upi or "",
            "gold_handle_local": obj.gold_handle_local or "",
            "jeweller_code": obj.jeweller_code or "",
            "default_jeweller_id": obj.default_jeweller_id,
            "jeweller_pref_nearby_id": obj.jeweller_pref_nearby_id,
            "jeweller_pref_ornament_id": obj.jeweller_pref_ornament_id,
            "jeweller_pref_redemption_id": obj.jeweller_pref_redemption_id,
            "balance_grams": str(grams),
            "vaults": wallet_vault_payload(obj) if obj.user_type == User.CUSTOMER else [],
        }
        return GoldWalletSerializer(instance=data).data


class VaultRowSerializer(serializers.Serializer):
    vault_public_id = serializers.CharField(allow_blank=True)
    custodian_id = serializers.IntegerField()
    custodian_label = serializers.CharField(allow_blank=True)
    fractional_grams = serializers.CharField()
    jeweller_metal_rate_inr_per_gram = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    estimated_fractional_value_inr = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    jeweller_metal_rate_last_updated_at = serializers.CharField(
        required=False, allow_blank=True, default=""
    )


class GoldWalletSerializer(serializers.Serializer):
    cridora_member_id = serializers.CharField()
    cridora_global_id = serializers.CharField(allow_blank=True)
    merchant_cridora_id = serializers.CharField(allow_blank=True)
    gold_upi = serializers.CharField(allow_blank=True)
    gold_handle_local = serializers.CharField(allow_blank=True)
    jeweller_code = serializers.CharField(allow_blank=True)
    default_jeweller_id = serializers.IntegerField(allow_null=True)
    jeweller_pref_nearby_id = serializers.IntegerField(allow_null=True)
    jeweller_pref_ornament_id = serializers.IntegerField(allow_null=True)
    jeweller_pref_redemption_id = serializers.IntegerField(allow_null=True)
    balance_grams = serializers.CharField()
    vaults = VaultRowSerializer(many=True)


class GoldTransferNotifySerializer(serializers.Serializer):
    grams = serializers.CharField()
    to_gold_upi = serializers.CharField()
    to_display_name = serializers.CharField()


class AdminNotificationSerializer(serializers.ModelSerializer):
    unread = serializers.SerializerMethodField()

    class Meta:
        model = AdminNotification
        fields = ("id", "kind", "title", "body", "link_path", "created_at", "unread")

    def get_unread(self, obj: AdminNotification):
        read_ids = self.context.get("read_ids")
        if read_ids is not None:
            return obj.pk not in read_ids
        request = self.context.get("request")
        if not request or not getattr(request.user, "is_authenticated", False):
            return True
        return not AdminNotificationRead.objects.filter(
            notification=obj, user=request.user
        ).exists()


def user_auth_payload(user):
    tokens = issue_tokens(user)
    tokens.update(
        {
            "user_id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "user_type": user.user_type,
            "kyc_status": user.kyc_status,
        }
    )
    return tokens
