from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    BankAccount,
    CrossRedemptionEvent,
    CrossRedemptionRequest,
    CrossRedemptionSagaStep,
    ExposureReservation,
    IntegrationOutbox,
    JewellerCrossPolicy,
    KYDocument,
    PersonalGoldHolding,
    PersonalHoldingDocument,
    PersonalPortfolioAuditLog,
    PortfolioUserNotification,
    SettlementBatch,
    SettlementObligation,
    User,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "user_type", "kyc_status", "is_staff")
    list_filter = ("user_type", "kyc_status")
    ordering = ("email",)
    search_fields = ("email", "business_name", "gstin")
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Profile", {"fields": ("email", "first_name", "last_name", "phone", "user_type")}),
        ("Jeweller (KYB)", {"fields": ("business_name", "gstin", "shop_address", "city", "state", "pincode")}),
        ("KYC / KYB", {"fields": ("kyc_status", "kyc_verified_at")}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "email", "password1", "password2", "user_type"),
            },
        ),
    )


@admin.register(KYDocument)
class KYDocumentAdmin(admin.ModelAdmin):
    list_display = ("user", "doc_type", "status", "uploaded_at")
    list_filter = ("doc_type", "status")
    search_fields = ("user__email",)


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ("user", "account_holder_name", "status", "updated_at")
    list_filter = ("status",)


@admin.register(PersonalGoldHolding)
class PersonalGoldHoldingAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "jeweller", "weight_grams", "verification_status", "is_removed", "updated_at")
    list_filter = ("verification_status", "is_removed", "category")
    search_fields = ("title", "user__email", "user__cridora_member_id")
    raw_id_fields = ("user", "jeweller", "removed_by")


@admin.register(PersonalHoldingDocument)
class PersonalHoldingDocumentAdmin(admin.ModelAdmin):
    list_display = ("holding", "document_type", "original_filename", "is_removed", "created_at")
    list_filter = ("document_type", "is_removed")
    raw_id_fields = ("holding",)


@admin.register(PersonalPortfolioAuditLog)
class PersonalPortfolioAuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "subject_user", "holding", "created_at")
    list_filter = ("action",)
    search_fields = ("subject_user__email",)
    raw_id_fields = ("subject_user", "holding", "document")


@admin.register(PortfolioUserNotification)
class PortfolioUserNotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "title", "read_at", "created_at")
    list_filter = ("kind",)
    search_fields = ("user__email", "title")
    raw_id_fields = ("user",)


@admin.register(JewellerCrossPolicy)
class JewellerCrossPolicyAdmin(admin.ModelAdmin):
    list_display = ("jeweller", "allow_cross_redemption", "require_source_approval", "trust_tier", "updated_at")
    raw_id_fields = ("jeweller",)


@admin.register(CrossRedemptionRequest)
class CrossRedemptionRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "source_jeweller",
        "destination_jeweller",
        "lifecycle_stage",
        "saga_status",
        "workflow_state",
        "deadline_at",
        "created_at",
    )
    list_filter = ("lifecycle_stage", "saga_status", "workflow_state")
    raw_id_fields = ("user", "source_jeweller", "destination_jeweller")
    search_fields = ("user__email",)


@admin.register(CrossRedemptionEvent)
class CrossRedemptionEventAdmin(admin.ModelAdmin):
    list_display = ("request", "actor", "event_type", "created_at")
    list_filter = ("actor",)
    raw_id_fields = ("request",)


@admin.register(ExposureReservation)
class ExposureReservationAdmin(admin.ModelAdmin):
    list_display = ("request", "source_jeweller", "destination_jeweller", "status", "reserved_value_inr")
    list_filter = ("status",)
    raw_id_fields = ("request", "source_jeweller", "destination_jeweller")


@admin.register(CrossRedemptionSagaStep)
class CrossRedemptionSagaStepAdmin(admin.ModelAdmin):
    list_display = ("request", "step_name", "direction", "status", "created_at")
    list_filter = ("status", "direction")
    raw_id_fields = ("request",)


@admin.register(IntegrationOutbox)
class IntegrationOutboxAdmin(admin.ModelAdmin):
    list_display = ("idempotency_key", "message_type", "status", "created_at")
    list_filter = ("status", "message_type")


@admin.register(SettlementBatch)
class SettlementBatchAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at")


@admin.register(SettlementObligation)
class SettlementObligationAdmin(admin.ModelAdmin):
    list_display = ("from_jeweller", "to_jeweller", "amount_inr", "status", "batch", "created_at")
    list_filter = ("status",)
    raw_id_fields = ("from_jeweller", "to_jeweller", "batch")
