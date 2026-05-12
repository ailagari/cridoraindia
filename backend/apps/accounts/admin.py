from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import BankAccount, KYDocument, User


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
