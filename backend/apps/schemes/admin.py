from django.contrib import admin

from .models import (
    CustomerSchemeEnrollment,
    JewellerSchemeOffering,
    SchemeContribution,
    SchemeCycleBonus,
    SchemeLedgerEntry,
    SchemeMonthBucket,
    SchemeRedemption,
    SchemeRequest,
    SchemeTemplate,
)


@admin.register(SchemeTemplate)
class SchemeTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "status", "category", "published_at", "updated_at")
    list_filter = ("status", "category")
    search_fields = ("name", "slug")


@admin.register(JewellerSchemeOffering)
class JewellerSchemeOfferingAdmin(admin.ModelAdmin):
    list_display = ("id", "jeweller_id", "scheme_template", "status", "enrolled_at")
    list_filter = ("status",)


@admin.register(CustomerSchemeEnrollment)
class CustomerSchemeEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("id", "customer_id", "status", "current_plan_month", "started_at")
    list_filter = ("status",)


admin.site.register(SchemeRequest)
admin.site.register(SchemeMonthBucket)
admin.site.register(SchemeContribution)
admin.site.register(SchemeLedgerEntry)
admin.site.register(SchemeCycleBonus)
admin.site.register(SchemeRedemption)
