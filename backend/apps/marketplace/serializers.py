from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    GoldTickerConfig,
    JewellerPricingProfile,
    MarketplaceProduct,
    get_or_create_ticker,
    jeweller_profile_for,
)
from .pricing import (
    gold_metal_value_inr,
    gold_rate_inr_per_gram,
    jeweller_buyback_display_inr_per_gram,
    reference_metal_rate_inr_per_gram_for_jeweller,
    sellback_rate_inr_per_gram,
    stone_component_inr,
)

User = get_user_model()


class GoldTickerReadSerializer(serializers.ModelSerializer):
    platform_base_inr_per_gram_22k = serializers.SerializerMethodField()

    class Meta:
        model = GoldTickerConfig
        fields = (
            "reference_price_inr_per_gram_22k",
            "admin_markup_percent",
            "platform_base_inr_per_gram_22k",
            "updated_at",
        )
        read_only_fields = fields

    def get_platform_base_inr_per_gram_22k(self, obj: GoldTickerConfig) -> str:
        return str(obj.platform_base_inr_per_gram())


class GoldTickerAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoldTickerConfig
        fields = ("reference_price_inr_per_gram_22k", "admin_markup_percent")


class JewellerPricingProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = JewellerPricingProfile
        fields = (
            "default_gold_markup_percent",
            "sellback_deduction_percent",
            "sellback_fixed_inr_per_gram",
            "gold_deposit_note",
            "representative_making_charge_inr_per_gram",
            "buyback_headline_inr_per_gram",
            "gold_deposit_yield_apr_percent",
            "gold_loan_interest_apr_percent",
            "logo_url",
            "credibility_score",
            "lock_in_summary",
            "minimum_redeemable_grams",
            "same_store_mc_benefit",
            "cross_redemption_fee_note",
            "metric_active_users",
            "metric_total_redeemed_gold_grams",
            "metric_years_active",
            "feat_instant_redemption",
            "feat_zero_mc_same_store",
            "feat_loan_available",
            "feat_goldnest_available",
            "feat_emergency_funds",
            "feat_cross_redemption",
            "updated_at",
        )
        read_only_fields = ("updated_at",)


def _annotate_product_public(product: MarketplaceProduct, ticker: GoldTickerConfig) -> dict:
    profile = jeweller_profile_for(product.jeweller)
    platform_base = ticker.platform_base_inr_per_gram()
    metal_rate = gold_rate_inr_per_gram(product, profile, platform_base)
    stone = stone_component_inr(product)
    metal_val = gold_metal_value_inr(product, metal_rate)
    gold_plus_stone = metal_val + stone
    sellback = sellback_rate_inr_per_gram(metal_rate, profile)

    jeweller_name = product.jeweller.business_name or product.jeweller.email
    return {
        "id": product.id,
        "jeweller_id": product.jeweller_id,
        "name": product.name,
        "category": product.category,
        "gold_weight_grams": str(product.gold_weight_grams),
        "making_charge_mode": product.making_charge_mode,
        "making_charge_per_gram": str(product.making_charge_per_gram),
        "making_charge_percent": (
            str(product.making_charge_percent)
            if product.making_charge_percent is not None
            else ""
        ),
        "image_url": product.image_url,
        "is_x_redeem": product.is_x_redeem,
        "rating": str(product.rating),
        "jeweller_name": jeweller_name,
        "jeweller_city": product.jeweller.city or "",
        "pricing_mode": product.pricing_mode,
        "platform_base_inr_per_gram_22k": str(platform_base),
        "metal_rate_inr_per_gram_used": str(metal_rate),
        "jeweller_markup_percent_applied": str(
            product.jeweller_markup_percent
            if product.jeweller_markup_percent is not None
            else profile.default_gold_markup_percent
        ),
        "gold_metal_value_inr": str(metal_val),
        "stone_component_inr": str(stone),
        "gold_plus_stone_inr": str(gold_plus_stone),
        "sellback_indicative_inr_per_gram": str(sellback),
        "sellback_deduction_percent": str(profile.sellback_deduction_percent),
        "sellback_fixed_inr_per_gram": str(profile.sellback_fixed_inr_per_gram),
        "gold_deposit_note": profile.gold_deposit_note,
        "stone_included": product.stone_included,
        "stone_type": product.stone_type,
        "stone_weight_grams": (
            str(product.stone_weight_grams)
            if product.stone_weight_grams is not None
            else ""
        ),
        "stone_cost_inr": (
            str(product.stone_cost_inr) if product.stone_cost_inr is not None else ""
        ),
        "same_store_benefit_note": product.same_store_benefit_note or "",
    }


class PublicMarketplaceProductSerializer(serializers.BaseSerializer):
    def to_representation(self, product: MarketplaceProduct):
        ticker = get_or_create_ticker()
        return _annotate_product_public(product, ticker)


def public_jeweller_storefront(user, ticker: GoldTickerConfig) -> dict:
    profile = jeweller_profile_for(user)
    platform_base = ticker.platform_base_inr_per_gram()
    ref_metal = reference_metal_rate_inr_per_gram_for_jeweller(profile, platform_base)
    buyback = jeweller_buyback_display_inr_per_gram(profile, platform_base)
    listing_count = MarketplaceProduct.objects.filter(
        jeweller=user,
        is_published=True,
        moderation_status=MarketplaceProduct.MOD_APPROVED,
    ).count()
    return {
        "id": user.id,
        "business_name": user.business_name or user.email,
        "city": user.city or "",
        "state": user.state or "",
        "shop_address": user.shop_address or "",
        "gstin": user.gstin or "",
        "kyc_status": user.kyc_status,
        "platform_base_inr_per_gram_22k": str(platform_base),
        "representative_making_charge_inr_per_gram": str(
            profile.representative_making_charge_inr_per_gram
        ),
        "buyback_indicative_inr_per_gram": str(buyback),
        "buyback_uses_headline_override": bool(
            profile.buyback_headline_inr_per_gram is not None
            and profile.buyback_headline_inr_per_gram > 0
        ),
        "reference_metal_inr_per_gram": str(ref_metal),
        "gold_deposit_yield_apr_percent": str(profile.gold_deposit_yield_apr_percent),
        "gold_loan_interest_apr_percent": str(profile.gold_loan_interest_apr_percent),
        "gold_deposit_note": profile.gold_deposit_note,
        "default_gold_markup_percent": str(profile.default_gold_markup_percent),
        "sellback_deduction_percent": str(profile.sellback_deduction_percent),
        "sellback_fixed_inr_per_gram": str(profile.sellback_fixed_inr_per_gram),
        "approved_listing_count": listing_count,
        "logo_url": profile.logo_url or "",
        "credibility_score": (
            str(profile.credibility_score)
            if profile.credibility_score is not None
            else ""
        ),
        "lock_in_summary": profile.lock_in_summary or "",
        "minimum_redeemable_grams": (
            str(profile.minimum_redeemable_grams)
            if profile.minimum_redeemable_grams is not None
            else ""
        ),
        "same_store_mc_benefit": profile.same_store_mc_benefit or "",
        "cross_redemption_fee_note": profile.cross_redemption_fee_note or "",
        "metric_active_users": profile.metric_active_users,
        "metric_total_redeemed_gold_grams": str(profile.metric_total_redeemed_gold_grams),
        "metric_years_active": str(profile.metric_years_active),
        "feat_instant_redemption": profile.feat_instant_redemption,
        "feat_zero_mc_same_store": profile.feat_zero_mc_same_store,
        "feat_loan_available": profile.feat_loan_available,
        "feat_goldnest_available": profile.feat_goldnest_available,
        "feat_emergency_funds": profile.feat_emergency_funds,
        "feat_cross_redemption": profile.feat_cross_redemption,
    }


class JewellerProductWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketplaceProduct
        fields = (
            "name",
            "category",
            "gold_weight_grams",
            "making_charge_mode",
            "making_charge_per_gram",
            "making_charge_percent",
            "image_url",
            "pricing_mode",
            "jeweller_markup_percent",
            "manual_gold_rate_inr_per_gram",
            "stone_included",
            "stone_type",
            "stone_weight_grams",
            "stone_cost_inr",
            "is_x_redeem",
            "rating",
            "is_published",
            "same_store_benefit_note",
        )

    def validate(self, attrs):
        from decimal import Decimal

        making_mode = attrs.get(
            "making_charge_mode",
            getattr(
                self.instance,
                "making_charge_mode",
                MarketplaceProduct.MAKING_FIXED_PER_GRAM,
            ),
        )
        if making_mode == MarketplaceProduct.MAKING_PERCENT_OF_METAL:
            pct = attrs.get(
                "making_charge_percent",
                getattr(self.instance, "making_charge_percent", None),
            )
            if pct is None or pct <= 0:
                raise serializers.ValidationError(
                    {
                        "making_charge_percent": "Required and must be > 0 for percentage making."
                    }
                )
            if pct > Decimal("100"):
                raise serializers.ValidationError(
                    {"making_charge_percent": "Percent cannot exceed 100."}
                )
        else:
            mpg = attrs.get(
                "making_charge_per_gram",
                getattr(self.instance, "making_charge_per_gram", None),
            )
            if mpg is None or mpg < 0:
                raise serializers.ValidationError(
                    {"making_charge_per_gram": "Making ₹/g must be zero or greater."}
                )
        mode = attrs.get("pricing_mode", getattr(self.instance, "pricing_mode", None))
        manual = attrs.get(
            "manual_gold_rate_inr_per_gram",
            getattr(self.instance, "manual_gold_rate_inr_per_gram", None),
        )
        if mode == MarketplaceProduct.PRICING_MANUAL_RATE:
            if manual is None or manual <= 0:
                raise serializers.ValidationError(
                    {
                        "manual_gold_rate_inr_per_gram": "Required and must be > 0 for manual gold rate mode."
                    }
                )
        stone_on = attrs.get("stone_included", getattr(self.instance, "stone_included", False))
        if stone_on:
            st = attrs.get("stone_type", getattr(self.instance, "stone_type", "") or "")
            if not str(st).strip():
                raise serializers.ValidationError(
                    {"stone_type": "Stone type is required when stone is included."}
                )
        return attrs


class JewellerProductReadSerializer(serializers.BaseSerializer):
    def to_representation(self, product: MarketplaceProduct):
        ticker = get_or_create_ticker()
        base = _annotate_product_public(product, ticker)
        base.update(
            {
                "moderation_status": product.moderation_status,
                "rejection_reason": product.rejection_reason,
                "created_at": product.created_at.isoformat(),
                "updated_at": product.updated_at.isoformat(),
            }
        )
        return base


class AdminProductModerationSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("approve", "reject"))
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["action"] == "reject" and not (attrs.get("reason") or "").strip():
            raise serializers.ValidationError(
                {"reason": "Reason required when rejecting."}
            )
        return attrs


class AdminProductRowSerializer(serializers.BaseSerializer):
    def to_representation(self, product: MarketplaceProduct):
        ticker = get_or_create_ticker()
        row = _annotate_product_public(product, ticker)
        row.update(
            {
                "moderation_status": product.moderation_status,
                "rejection_reason": product.rejection_reason,
                "is_published": product.is_published,
                "jeweller_email": product.jeweller.email,
                "created_at": product.created_at.isoformat(),
            }
        )
        return row
