from django.contrib import admin

from .models import JewellerPricingProfile, MetalPurity, ProductCategory


@admin.register(MetalPurity)
class MetalPurityAdmin(admin.ModelAdmin):
    list_display = ("label", "slug", "fine_fraction", "sort_order", "is_active")
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
