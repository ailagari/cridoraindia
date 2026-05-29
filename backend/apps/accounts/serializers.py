from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from decimal import Decimal
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .jeweller_liability_service import jeweller_liability_grams
from .wallet_extras import (
    customer_completed_fractional_ledger,
    customer_portfolio_unrealized_summary,
    jeweller_recent_liability_credits,
)
from .models import (
    AdminNotification,
    AdminNotificationRead,
    BankAccount,
    FestivalBroadcastNotification,
    KYDocument,
)
from apps.marketplace.models import jeweller_profile_for

from .vault_service import sync_customer_aggregate_balance, wallet_vault_payload
from .services.personal_holdings import customer_portfolio_totals_payload

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


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        user = self.context["request"].user
        current = attrs.get("current_password") or ""
        new_pw = attrs.get("new_password") or ""
        if not user.check_password(current):
            raise serializers.ValidationError(
                {"current_password": "Current password is incorrect."}
            )
        if current == new_pw:
            raise serializers.ValidationError(
                {"new_password": "New password must differ from your current password."}
            )
        validate_password(new_pw, user)
        return attrs


class CustomerRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    referral_code = serializers.CharField(
        max_length=12, required=False, allow_blank=True
    )
    onboarding_jeweller_id = serializers.IntegerField(
        required=False, allow_null=True
    )

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value.strip()).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return value.lower().strip()

    def validate_onboarding_jeweller_id(self, value):
        if value in (None, ""):
            return None
        try:
            jid = int(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError("Must be a jeweller id.")
        if jid <= 0:
            return None
        return jid

    def create(self, validated_data):
        from .services.jeweller_referral import apply_customer_onboarding_jeweller

        referral_raw = (validated_data.pop("referral_code", None) or "").strip()
        jeweller_id = validated_data.pop("onboarding_jeweller_id", None)
        email = validated_data["email"]
        user = User.objects.create_user(
            username=email,
            email=email,
            password=validated_data["password"],
            first_name=validated_data.get("first_name", "").strip(),
            last_name=validated_data.get("last_name", "").strip(),
            phone=(validated_data.get("phone") or "").strip(),
            user_type=User.CUSTOMER,
        )
        warning = apply_customer_onboarding_jeweller(
            user,
            referral_code=referral_raw or None,
            jeweller_id=jeweller_id,
        )
        self.referral_warning = warning
        self.onboarding_jeweller_applied = bool(
            user.default_jeweller_id and not warning
        )
        return user


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


class CustomerPersonalProfileSerializer(serializers.Serializer):
    """Customer-only PATCH for contact name and phone."""

    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)


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
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "user_type",
            "phone",
            "profile_photo_url",
            "logo_url",
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
            "jeweller_referral_code",
            "default_jeweller",
            "onboarded_by_jeweller",
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
            "jeweller_referral_code",
            "default_jeweller",
            "onboarded_by_jeweller",
            "jeweller_pref_nearby",
            "jeweller_pref_ornament",
            "jeweller_pref_redemption",
            "logo_url",
            "bank_account",
            "documents",
            "gold_wallet",
        )

    def get_logo_url(self, obj):
        if obj.user_type != User.JEWELLER:
            return ""
        try:
            profile = jeweller_profile_for(obj)
        except Exception:
            return ""
        return (profile.logo_url or "").strip()

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
        if obj.user_type == User.CUSTOMER and obj.gold_routing_code:
            from .vault_routing_codes import format_routing_address

            cridora_primary = format_routing_address(obj.gold_routing_code)
        else:
            cridora_primary = f"{handle}@cridora" if handle else ""
        liability_s = ""
        if obj.user_type == User.JEWELLER:
            liability_s = str(jeweller_liability_grams(obj))
        vaults_list = wallet_vault_payload(obj) if obj.user_type == User.CUSTOMER else []
        pnl_block = (
            customer_portfolio_unrealized_summary(obj, grams, vaults_list)
            if obj.user_type == User.CUSTOMER
            else None
        )
        portfolio_totals = (
            customer_portfolio_totals_payload(obj) if obj.user_type == User.CUSTOMER else {}
        )
        secondary_ids: list[int] = []
        if obj.user_type == User.CUSTOMER:
            from .services.jeweller_referral import customer_secondary_jeweller_ids

            secondary_ids = customer_secondary_jeweller_ids(obj)
        data = {
            "cridora_member_id": obj.cridora_member_id or "",
            "cridora_global_id": cridora_primary,
            "merchant_cridora_id": f"{code}@cridora" if code else "",
            "gold_upi": obj.gold_upi or "",
            "gold_handle_local": obj.gold_handle_local or "",
            "jeweller_code": obj.jeweller_code or "",
            "default_jeweller_id": obj.default_jeweller_id,
            "secondary_jeweller_ids": secondary_ids,
            "jeweller_pref_nearby_id": obj.jeweller_pref_nearby_id,
            "jeweller_pref_ornament_id": obj.jeweller_pref_ornament_id,
            "jeweller_pref_redemption_id": obj.jeweller_pref_redemption_id,
            "balance_grams": str(grams),
            "vaults": vaults_list,
            "custodial_liability_grams": liability_s,
            "fractional_ledger": customer_completed_fractional_ledger(obj)
            if obj.user_type == User.CUSTOMER
            else [],
            "recent_liability_credits": jeweller_recent_liability_credits(obj)
            if obj.user_type == User.JEWELLER
            else [],
            "portfolio_unrealized": pnl_block,
            "portfolio_totals": portfolio_totals,
        }
        return GoldWalletSerializer(instance=data).data


class VaultRowSerializer(serializers.Serializer):
    vault_public_id = serializers.CharField(allow_blank=True)
    custodian_id = serializers.IntegerField()
    custodian_label = serializers.CharField(allow_blank=True)
    is_primary_custodian = serializers.BooleanField(required=False, default=False)
    fractional_grams = serializers.CharField()
    deposit_grams = serializers.CharField(required=False, allow_blank=True, default="0")
    golden_scheme_grams = serializers.CharField(required=False, allow_blank=True, default="0")
    vault_total_grams = serializers.CharField(required=False, allow_blank=True, default="0")
    jeweller_metal_rate_inr_per_gram = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    estimated_fractional_value_inr = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    estimated_deposit_value_inr = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    estimated_golden_scheme_value_inr = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    estimated_vault_value_inr = serializers.CharField(
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
    secondary_jeweller_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    jeweller_pref_nearby_id = serializers.IntegerField(allow_null=True)
    jeweller_pref_ornament_id = serializers.IntegerField(allow_null=True)
    jeweller_pref_redemption_id = serializers.IntegerField(allow_null=True)
    balance_grams = serializers.CharField()
    vaults = VaultRowSerializer(many=True)
    custodial_liability_grams = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    fractional_ledger = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )
    recent_liability_credits = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )
    portfolio_unrealized = serializers.DictField(
        required=False, allow_null=True, default=None
    )
    portfolio_totals = serializers.DictField(
        required=False, allow_null=True, default=dict
    )
    jeweller_total_revenue_inr = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    jeweller_revenue_by_kind = serializers.DictField(
        required=False, default=dict
    )
    jeweller_portfolio = serializers.DictField(required=False, default=dict)


class GoldTransferNotifySerializer(serializers.Serializer):
    grams = serializers.CharField()
    to_gold_upi = serializers.CharField()
    to_display_name = serializers.CharField()


class AdminNotificationSerializer(serializers.ModelSerializer):
    unread = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()

    class Meta:
        model = AdminNotification
        fields = ("id", "kind", "title", "body", "link_path", "created_at", "unread")

    def get_body(self, obj: AdminNotification) -> str:
        raw = obj.body or ""
        if obj.kind == AdminNotification.KIND_FESTIVAL_BROADCAST_SENT:
            from apps.accounts.services.festival_broadcast import strip_festival_broadcast_feed_body

            return strip_festival_broadcast_feed_body(raw)
        return raw

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


class FestivalBroadcastNotificationSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = FestivalBroadcastNotification
        fields = (
            "id",
            "title",
            "body",
            "image_url",
            "logo_url",
            "scheduled_at",
            "expires_at",
            "target_type",
            "target_metadata",
            "status",
            "sent_at",
            "push_recipient_count",
            "error_message",
            "created_by_email",
            "created_at",
        )
        read_only_fields = fields


class FestivalBroadcastNotificationCreateSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )
    body = serializers.CharField(max_length=2000, min_length=1)
    image_url = serializers.URLField(required=False, allow_blank=True, max_length=512)
    logo_url = serializers.URLField(required=False, allow_blank=True, max_length=512)
    scheduled_at = serializers.DateTimeField()
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    target_type = serializers.ChoiceField(
        choices=FestivalBroadcastNotification.TARGET_CHOICES,
        required=False,
        default=FestivalBroadcastNotification.TARGET_ALL_USERS,
    )
    target_metadata = serializers.JSONField(required=False, default=dict)

    def create(self, validated_data):
        request = self.context["request"]
        title = (validated_data.get("title") or "").strip() or "Cridora"
        body = validated_data["body"].strip()
        image_url = (validated_data.get("image_url") or "").strip()
        logo_url = (validated_data.get("logo_url") or "").strip()
        scheduled_at = validated_data["scheduled_at"]
        meta = validated_data.get("target_metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        return FestivalBroadcastNotification.objects.create(
            title=title,
            body=body,
            image_url=image_url,
            logo_url=logo_url,
            scheduled_at=scheduled_at,
            expires_at=validated_data.get("expires_at"),
            target_type=validated_data.get("target_type")
            or FestivalBroadcastNotification.TARGET_ALL_USERS,
            target_metadata=meta,
            created_by=request.user,
        )


def user_auth_payload(user):
    tokens = issue_tokens(user)
    logo_url = ""
    if user.user_type == User.JEWELLER:
        try:
            logo_url = (jeweller_profile_for(user).logo_url or "").strip()
        except Exception:
            logo_url = ""
    tokens.update(
        {
            "user_id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "user_type": user.user_type,
            "kyc_status": user.kyc_status,
            "business_name": user.business_name,
            "profile_photo_url": (user.profile_photo_url or "").strip(),
            "logo_url": logo_url,
        }
    )
    return tokens
