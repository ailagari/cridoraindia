from django.contrib import admin

from .models import GoldRateDailySnapshot, GoldTickerReferenceHistory, JewellerPricingProfile, MetalPurity, ProductCategory


@admin.register(GoldTickerReferenceHistory)
class GoldTickerReferenceHistoryAdmin(admin.ModelAdmin):
    list_display = ("recorded_at", "inr_per_gram_22k", "base_source")
    ordering = ("-recorded_at",)


@admin.register(GoldRateDailySnapshot)
class GoldRateDailySnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "snapshot_date",
        "close_inr",
        "change_inr",
        "change_pct",
        "high_inr",
        "low_inr",
        "sample_count",
        "base_source",
    )
    ordering = ("-snapshot_date",)
    date_hierarchy = "snapshot_date"
@admin.register(MetalPurity)
class MetalPurityAdmin(admin.ModelAdmin):
    list_display = ("label", "slug", "fine_fraction", "spot_family", "spot_key", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("label", "slug")
    ordering = ("sort_order", "id")


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("label", "slug", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("label", "slug")
    ordering = ("sort_order", "id")


@admin.register(JewellerPricingProfile)
class JewellerPricingProfileAdmin(admin.ModelAdmin):
    list_display = ("jeweller",)
    raw_id_fields = ("jeweller",)
    filter_horizontal = ("metal_purities_offered",)
