from django.contrib.auth import get_user_model
from decimal import Decimal
from rest_framework import serializers

from apps.accounts.services.media_storage import delete_replaced_media_url

from .models import (
    GoldTickerConfig,
    JewellerPricingProfile,
    MarketplaceProduct,
    MetalPurity,
    ProductCategory,
    allowed_metal_purities_qs,
    get_or_create_ticker,
    jeweller_profile_for,
)
from .metal_pricing import (
    METAL_CODES,
    MODE_MANUAL_BOARD,
    cridora_reference_inr_per_metal,
    indicative_buyback_inr_per_metal,
    jeweller_effective_rate_inr,
    normalize_metal_buyback_json,
    normalize_metal_pricing_json,
    sync_gold_22k_legacy_fields_from_json,
)
from .pricing import (
    gold_metal_value_inr,
    gold_rate_inr_per_gram,
    jeweller_buyback_display_inr_per_gram,
    jeweller_rate_effective_updated_at,
    jeweller_store_22k_inr,
    reference_metal_rate_inr_per_gram_for_jeweller,
    sellback_rate_inr_per_gram,
    stone_component_inr,
)
from .metal_ticker_adjustments import (
    METAL_ADMIN_ROWS,
    OPTIONAL_LIVE_PREVIEW_KEYS,
    admin_deduction_for_jeweller_metal,
    adjusted_inr_from_float,
    after_markup_inr_from_decimal,
)
from .spot_prices import (
    get_raw_spot_payload_for_admin_preview,
    public_spot_prices_payload,
    resolve_cridora_base_22k_inr,
)

User = get_user_model()


class GoldTickerReadSerializer(serializers.ModelSerializer):
    platform_base_inr_per_gram_22k = serializers.SerializerMethodField()
    cridora_base_source = serializers.SerializerMethodField()
    live_spot_raw_preview = serializers.SerializerMethodField()
    last_platform_rate_change = serializers.SerializerMethodField()

    class Meta:
        model = GoldTickerConfig
        fields = (
            "live_metal_adjustments_json",
            "live_spot_raw_preview",
            "rate_move_alert_threshold_inr",
            "rate_move_alerts_enabled",
            "rate_alert_baseline_inr_per_gram_22k",
            "hourly_gold_push_enabled",
            "hourly_gold_push_title",
            "hourly_gold_push_link",
            "rate_move_alert_title",
            "rate_move_alert_link",
            "gold_push_image_url",
            "portfolio_gain_threshold_inr",
            "portfolio_gain_threshold_percent",
            "holding_gain_threshold_inr",
            "max_gold_alerts_per_day",
            "max_portfolio_alerts_per_day",
            "holding_milestone_threshold_inr",
            "portfolio_milestone_thresholds_inr",
            "active_engagement_context",
            "active_festival_name",
            "active_festival_message",
            "engagement_context_starts_at",
            "engagement_context_ends_at",
            "enable_educational_engagement",
            "enable_monthly_storytelling_push",
            "hourly_gold_push_baseline_inr_per_gram_22k",
            "hourly_gold_push_baseline_recorded_at",
            "manual_ticker_enabled",
            "ticker_manual_22k_inr_per_gram",
            "ticker_manual_24k_inr_per_gram",
            "ticker_manual_18k_inr_per_gram",
            "ticker_manual_silver_999_inr_per_gram",
            "gold_deposit_yield_apr_percent",
            "gold_loan_interest_apr_percent",
            "gold_loan_processing_fee_percent",
            "gold_loan_processing_fee_jeweller_share_percent",
            "gold_loan_ltv_min_percent",
            "gold_loan_ltv_max_percent",
            "cross_platform_fee_inr",
            "platform_base_inr_per_gram_22k",
            "cridora_base_source",
            "last_platform_rate_change",
            "updated_at",
        )
        read_only_fields = fields

    def get_last_platform_rate_change(self, obj: GoldTickerConfig) -> dict | None:
        from .models import GoldRateHistory

        row = GoldRateHistory.objects.filter(jeweller__isnull=True).order_by("-created_at").first()
        if not row:
            return None
        return {
            "previous_rate": str(row.previous_rate),
            "new_rate": str(row.new_rate),
            "difference": str(row.difference),
            "created_at": row.created_at.isoformat(),
        }

    def get_platform_base_inr_per_gram_22k(self, obj: GoldTickerConfig) -> str:
        base, _ = resolve_cridora_base_22k_inr()
        return str(base)

    def get_cridora_base_source(self, obj: GoldTickerConfig) -> str:
        _, src = resolve_cridora_base_22k_inr()
        return src

    def get_live_spot_raw_preview(self, obj: GoldTickerConfig) -> dict:
        raw = get_raw_spot_payload_for_admin_preview()
        gold = raw.get("gold") if isinstance(raw.get("gold"), dict) else {}
        silver = raw.get("silver") if isinstance(raw.get("silver"), dict) else {}
        rows: list[dict] = []
        for family, key, label in METAL_ADMIN_ROWS:
            rv = gold.get(key) if family == "gold" else silver.get(key)
            if rv is None and (family, key) in OPTIONAL_LIVE_PREVIEW_KEYS:
                continue
            if rv is None:
                rows.append(
                    {
                        "family": family,
                        "key": key,
                        "label": label,
                        "raw_inr_per_gram": None,
                        "after_markup_inr_per_gram": None,
                        "final_inr_per_gram": None,
                    }
                )
                continue
            try:
                rvf = float(rv)
            except (TypeError, ValueError):
                rows.append(
                    {
                        "family": family,
                        "key": key,
                        "label": label,
                        "raw_inr_per_gram": None,
                        "after_markup_inr_per_gram": None,
                        "final_inr_per_gram": None,
                    }
                )
                continue
            d_raw = Decimal(str(rvf))
            mid = after_markup_inr_from_decimal(d_raw, family=family, key=key, ticker=obj)
            adj = adjusted_inr_from_float(rvf, family=family, key=key, ticker=obj)
            rows.append(
                {
                    "family": family,
                    "key": key,
                    "label": label,
                    "raw_inr_per_gram": str(rvf),
                    "after_markup_inr_per_gram": str(mid),
                    "final_inr_per_gram": str(adj),
                }
            )
        return {
            "source": raw.get("source") or "",
            "source_updated_at": raw.get("source_updated_at") or "",
            "rate_date": raw.get("rate_date") or "",
            "rows": rows,
        }


class GoldTickerPublicSerializer(serializers.ModelSerializer):
    """Public storefront: resolved metal base plus checkout/platform fees surfaced here."""

    platform_base_inr_per_gram_22k = serializers.SerializerMethodField()
    cridora_base_source = serializers.SerializerMethodField()

    class Meta:
        model = GoldTickerConfig
        fields = (
            "platform_base_inr_per_gram_22k",
            "cridora_base_source",
            "cross_platform_fee_inr",
            "updated_at",
        )
        read_only_fields = fields

    def get_platform_base_inr_per_gram_22k(self, obj: GoldTickerConfig) -> str:
        base, _ = resolve_cridora_base_22k_inr()
        return str(base)

    def get_cridora_base_source(self, obj: GoldTickerConfig) -> str:
        _, src = resolve_cridora_base_22k_inr()
        return src


class GoldTickerAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoldTickerConfig
        fields = (
            "live_metal_adjustments_json",
            "rate_move_alert_threshold_inr",
            "rate_move_alerts_enabled",
            "hourly_gold_push_enabled",
            "hourly_gold_push_title",
            "hourly_gold_push_link",
            "rate_move_alert_title",
            "rate_move_alert_link",
            "gold_push_image_url",
            "portfolio_gain_threshold_inr",
            "portfolio_gain_threshold_percent",
            "holding_gain_threshold_inr",
            "max_gold_alerts_per_day",
            "max_portfolio_alerts_per_day",
            "holding_milestone_threshold_inr",
            "portfolio_milestone_thresholds_inr",
            "active_engagement_context",
            "active_festival_name",
            "active_festival_message",
            "engagement_context_starts_at",
            "engagement_context_ends_at",
            "enable_educational_engagement",
            "enable_monthly_storytelling_push",
            "manual_ticker_enabled",
            "ticker_manual_22k_inr_per_gram",
            "ticker_manual_24k_inr_per_gram",
            "ticker_manual_18k_inr_per_gram",
            "ticker_manual_silver_999_inr_per_gram",
            "gold_deposit_yield_apr_percent",
            "gold_loan_interest_apr_percent",
            "gold_loan_processing_fee_percent",
            "gold_loan_processing_fee_jeweller_share_percent",
            "gold_loan_ltv_min_percent",
            "gold_loan_ltv_max_percent",
            "cross_platform_fee_inr",
        )

    def validate_gold_loan_ltv_min_percent(self, value):
        if value < Decimal("0") or value > Decimal("100"):
            raise serializers.ValidationError("Must be between 0 and 100.")
        return value

    def validate_gold_loan_ltv_max_percent(self, value):
        if value < Decimal("0") or value > Decimal("100"):
            raise serializers.ValidationError("Must be between 0 and 100.")
        return value

    def validate_gold_loan_processing_fee_jeweller_share_percent(self, value):
        if value < Decimal("0") or value > Decimal("100"):
            raise serializers.ValidationError("Must be between 0 and 100.")
        return value

    def validate_live_metal_adjustments_json(self, value):
        from .metal_ticker_adjustments import normalize_live_metal_adjustments_json

        if value is None:
            return {}
        return normalize_live_metal_adjustments_json(value)

    def validate_rate_move_alert_threshold_inr(self, value):
        if value < 0:
            raise serializers.ValidationError("Must be zero or greater (0 disables alerts).")
        return value

    def validate(self, attrs):
        from decimal import Decimal

        enabled = attrs.get("manual_ticker_enabled")
        if enabled is None and self.instance is not None:
            enabled = self.instance.manual_ticker_enabled

        key_22 = "ticker_manual_22k_inr_per_gram"
        k22 = attrs.get(key_22) if key_22 in attrs else None
        if k22 is None and self.instance is not None:
            k22 = self.instance.ticker_manual_22k_inr_per_gram

        key_24 = "ticker_manual_24k_inr_per_gram"
        k24 = attrs.get(key_24) if key_24 in attrs else None
        if key_24 not in attrs and self.instance is not None:
            k24 = self.instance.ticker_manual_24k_inr_per_gram

        key_18 = "ticker_manual_18k_inr_per_gram"
        k18 = attrs.get(key_18) if key_18 in attrs else None
        if key_18 not in attrs and self.instance is not None:
            k18 = self.instance.ticker_manual_18k_inr_per_gram

        key_silver = "ticker_manual_silver_999_inr_per_gram"
        s999 = attrs.get(key_silver) if key_silver in attrs else None
        if key_silver not in attrs and self.instance is not None:
            s999 = self.instance.ticker_manual_silver_999_inr_per_gram

        if enabled:
            if k22 is None or k22 <= Decimal("0"):
                raise serializers.ValidationError(
                    {
                        key_22: "Enter a positive 22K ₹/g when manual ticker is enabled.",
                    }
                )
        if k24 is not None and k24 <= Decimal("0"):
            raise serializers.ValidationError(
                {key_24: "Leave blank or enter a positive 24K ₹/g."}
            )
        if k18 is not None and k18 <= Decimal("0"):
            raise serializers.ValidationError(
                {key_18: "Leave blank or enter a positive 18K ₹/g."}
            )
        if s999 is not None and s999 <= Decimal("0"):
            raise serializers.ValidationError(
                {key_silver: "Leave blank or enter a positive silver 999 ₹/g."}
            )

        min_ltv = attrs.get("gold_loan_ltv_min_percent")
        max_ltv = attrs.get("gold_loan_ltv_max_percent")
        if min_ltv is None and self.instance is not None:
            min_ltv = self.instance.gold_loan_ltv_min_percent
        if max_ltv is None and self.instance is not None:
            max_ltv = self.instance.gold_loan_ltv_max_percent
        if min_ltv is not None and max_ltv is not None and min_ltv > max_ltv:
            raise serializers.ValidationError(
                {"gold_loan_ltv_max_percent": "Must be greater than or equal to minimum LTV."}
            )
        return attrs

    def update(self, instance, validated_data):
        if "gold_push_image_url" in validated_data:
            delete_replaced_media_url(
                old_url=instance.gold_push_image_url,
                new_url=validated_data["gold_push_image_url"],
            )
        return super().update(instance, validated_data)

    def validate_gold_loan_processing_fee_percent(self, value):
        if value < Decimal("0"):
            raise serializers.ValidationError("Must be zero or greater.")
        if value > Decimal("100"):
            raise serializers.ValidationError("Must not exceed 100%.")
        return value

    def validate_cross_platform_fee_inr(self, value):
        if value < Decimal("0"):
            raise serializers.ValidationError("Must be zero or greater.")
        return value


class JewellerPricingProfileSerializer(serializers.ModelSerializer):
    jeweller_metal_rate_effective_updated_at = serializers.SerializerMethodField()
    gold_deposit_yield_apr_percent = serializers.SerializerMethodField()
    gold_loan_interest_apr_percent = serializers.SerializerMethodField()
    gold_loan_processing_fee_percent = serializers.SerializerMethodField()
    gold_loan_ltv_min_percent = serializers.SerializerMethodField()
    gold_loan_ltv_max_percent = serializers.SerializerMethodField()
    gold_loan_processing_fee_jeweller_share_percent = serializers.SerializerMethodField()
    metal_rate_preview = serializers.SerializerMethodField()
    admin_buyback_reference_preview = serializers.SerializerMethodField()
    metal_purities_offered = serializers.SerializerMethodField()
    metal_purity_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
    )

    class Meta:
        model = JewellerPricingProfile
        fields = (
            "metal_pricing_json",
            "metal_buyback_json",
            "gold_loan_jeweller_deduction_inr_per_gram",
            "gold_loan_ltv_percent",
            "gold_rate_source",
            "gold_rate_external_api_url",
            "manual_gold_rate_inr_per_gram",
            "live_markup_percent",
            "live_markup_inr_per_gram",
            "default_gold_markup_percent",
            "sellback_deduction_percent",
            "sellback_fixed_inr_per_gram",
            "gold_deposit_note",
            "representative_making_charge_inr_per_gram",
            "buyback_headline_inr_per_gram",
            "gold_deposit_yield_apr_percent",
            "gold_loan_interest_apr_percent",
            "gold_loan_processing_fee_percent",
            "gold_loan_ltv_min_percent",
            "gold_loan_ltv_max_percent",
            "gold_loan_processing_fee_jeweller_share_percent",
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
            "golden_scheme_enabled",
            "golden_scheme_duration_months",
            "golden_scheme_min_monthly_inr",
            "golden_scheme_lock_in_note",
            "golden_scheme_benefits",
            "golden_scheme_rate_application_note",
            "updated_at",
            "jeweller_metal_rate_effective_updated_at",
            "metal_rate_preview",
            "admin_buyback_reference_preview",
            "metal_purities_offered",
            "metal_purity_ids",
        )
        read_only_fields = (
            "updated_at",
            "jeweller_metal_rate_effective_updated_at",
            "gold_rate_source",
            "gold_rate_external_api_url",
            "manual_gold_rate_inr_per_gram",
            "live_markup_percent",
            "live_markup_inr_per_gram",
            "sellback_deduction_percent",
            "sellback_fixed_inr_per_gram",
            "gold_deposit_yield_apr_percent",
            "gold_loan_interest_apr_percent",
            "gold_loan_processing_fee_percent",
            "gold_loan_ltv_min_percent",
            "gold_loan_ltv_max_percent",
            "gold_loan_processing_fee_jeweller_share_percent",
            "credibility_score",
            "metal_rate_preview",
            "admin_buyback_reference_preview",
        )

    def get_metal_purities_offered(self, obj: JewellerPricingProfile) -> list[dict[str, str | int]]:
        rows = obj.metal_purities_offered.filter(is_active=True).order_by("sort_order", "id")
        return [{"id": p.id, "slug": p.slug, "label": p.label} for p in rows]

    def get_jeweller_metal_rate_effective_updated_at(self, obj: JewellerPricingProfile) -> str:
        return jeweller_rate_effective_updated_at(obj).isoformat()

    def get_gold_deposit_yield_apr_percent(self, obj: JewellerPricingProfile) -> str:
        t = get_or_create_ticker()
        return str(t.gold_deposit_yield_apr_percent)

    def get_gold_loan_interest_apr_percent(self, obj: JewellerPricingProfile) -> str:
        t = get_or_create_ticker()
        return str(t.gold_loan_interest_apr_percent)

    def get_gold_loan_processing_fee_percent(self, obj: JewellerPricingProfile) -> str:
        t = get_or_create_ticker()
        return str(t.gold_loan_processing_fee_percent)

    def get_gold_loan_ltv_min_percent(self, obj: JewellerPricingProfile) -> str:
        t = get_or_create_ticker()
        return str(t.gold_loan_ltv_min_percent)

    def get_gold_loan_ltv_max_percent(self, obj: JewellerPricingProfile) -> str:
        t = get_or_create_ticker()
        return str(t.gold_loan_ltv_max_percent)

    def get_gold_loan_processing_fee_jeweller_share_percent(self, obj: JewellerPricingProfile) -> str:
        t = get_or_create_ticker()
        return str(t.gold_loan_processing_fee_jeweller_share_percent)

    def validate_gold_loan_ltv_percent(self, value):
        if value is None:
            return value
        if value < Decimal("0") or value > Decimal("100"):
            raise serializers.ValidationError("Must be between 0 and 100.")
        ticker = get_or_create_ticker()
        from .loan_policy import validate_ltv_bounds

        err = validate_ltv_bounds(value, ticker)
        if err:
            raise serializers.ValidationError(err)
        return value

    def validate(self, attrs):
        feat = attrs.get("feat_loan_available")
        if feat is None and self.instance is not None:
            feat = self.instance.feat_loan_available
        ltv = attrs.get("gold_loan_ltv_percent")
        if ltv is None and self.instance is not None:
            ltv = self.instance.gold_loan_ltv_percent
        if feat and ltv is None:
            raise serializers.ValidationError(
                {
                    "gold_loan_ltv_percent": (
                        "Set your max loan % of collateral when gold loans are enabled."
                    )
                }
            )
        return attrs

    def get_metal_rate_preview(self, obj: JewellerPricingProfile) -> dict[str, dict[str, str]]:
        spot = public_spot_prices_payload()
        base, _ = resolve_cridora_base_22k_inr()
        out: dict[str, dict[str, str]] = {}
        for code in METAL_CODES:
            ref = cridora_reference_inr_per_metal(
                code, cridora_base_22k=base, spot=spot
            )
            eff = jeweller_effective_rate_inr(
                obj, code, cridora_base_22k=base, spot=spot
            )
            buy = indicative_buyback_inr_per_metal(
                obj, code, jeweller_effective_inr_per_gram=eff
            )
            out[code] = {
                "cridora_inr_per_gram": str(ref),
                "your_board_inr_per_gram": str(eff),
                "preview_buyback_inr_per_gram": str(buy),
            }
        return out

    def get_admin_buyback_reference_preview(
        self, obj: JewellerPricingProfile
    ) -> dict[str, dict[str, str]]:
        t = get_or_create_ticker()
        out: dict[str, dict[str, str]] = {}
        for code in METAL_CODES:
            dm, da = admin_deduction_for_jeweller_metal(t, code)
            out[code] = {"mode": dm, "amount": str(da)}
        return out

    def validate(self, attrs):
        pmap = attrs.get("metal_pricing_json")
        if pmap is not None:
            norm = normalize_metal_pricing_json(pmap)
            g22 = norm.get("gold_22k") or {}
            if g22.get("mode") == MODE_MANUAL_BOARD:
                try:
                    m = Decimal(str(g22.get("manual_inr_per_gram") or "0"))
                except Exception:
                    m = Decimal("0")
                if m <= 0:
                    raise serializers.ValidationError(
                        {
                            "metal_pricing_json": (
                                "Gold 22K fixed board ₹/g must be greater than zero."
                            )
                        }
                    )
        return attrs

    def update(self, instance, validated_data):
        ids = validated_data.pop("metal_purity_ids", None)
        if "metal_pricing_json" in validated_data:
            validated_data["metal_pricing_json"] = normalize_metal_pricing_json(
                validated_data["metal_pricing_json"]
            )
        if "metal_buyback_json" in validated_data:
            validated_data["metal_buyback_json"] = normalize_metal_buyback_json(
                validated_data["metal_buyback_json"]
            )
        inst = super().update(instance, validated_data)
        sync_gold_22k_legacy_fields_from_json(inst)
        inst.save()
        if ids is not None:
            allowed = MetalPurity.objects.filter(pk__in=ids, is_active=True)
            inst.metal_purities_offered.set(allowed)
        return inst


def _annotate_product_public(
    product: MarketplaceProduct, *, expose_platform_base: bool = False
) -> dict:
    profile = jeweller_profile_for(product.jeweller)
    ticker = get_or_create_ticker()
    cridora_base, base_source = resolve_cridora_base_22k_inr()
    metal_rate = gold_rate_inr_per_gram(product, profile, cridora_base)
    stone = stone_component_inr(product)
    metal_val = gold_metal_value_inr(product, metal_rate)
    gold_plus_stone = metal_val + stone
    sellback = sellback_rate_inr_per_gram(metal_rate, profile)
    rate_as_of = jeweller_rate_effective_updated_at(profile)

    jeweller_name = product.jeweller.business_name or product.jeweller.email
    cat_label = (
        product.product_category.label
        if getattr(product, "product_category_id", None)
        else product.category
    )
    row = {
        "id": product.id,
        "jeweller_id": product.jeweller_id,
        "name": product.name,
        "category": cat_label,
        "product_category_id": product.product_category_id,
        "metal_purity_id": product.metal_purity_id,
        "metal_purity_slug": (
            product.metal_purity.slug if getattr(product, "metal_purity_id", None) else ""
        ),
        "metal_purity_label": (
            product.metal_purity.label if getattr(product, "metal_purity_id", None) else ""
        ),
        "stock_quantity": product.stock_quantity,
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
        "is_published": product.is_published,
        "rating": str(product.rating),
        "jeweller_name": jeweller_name,
        "jeweller_city": product.jeweller.city or "",
        "pricing_mode": product.pricing_mode,
        "jeweller_markup_percent": (
            str(product.jeweller_markup_percent)
            if product.jeweller_markup_percent is not None
            else ""
        ),
        "manual_gold_rate_inr_per_gram": (
            str(product.manual_gold_rate_inr_per_gram)
            if product.manual_gold_rate_inr_per_gram is not None
            else ""
        ),
        "jeweller_metal_rate_last_updated_at": rate_as_of.isoformat(),
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
        "same_store_making_charge_percent": (
            str(product.same_store_making_charge_percent)
            if product.same_store_making_charge_percent is not None
            else ""
        ),
        "same_store_making_charge_per_gram": (
            str(product.same_store_making_charge_per_gram)
            if product.same_store_making_charge_per_gram is not None
            else ""
        ),
        "cross_platform_fee_inr": str(ticker.cross_platform_fee_inr),
    }
    if expose_platform_base:
        row["platform_base_inr_per_gram_22k"] = str(cridora_base)
        row["cridora_base_source"] = base_source
    return row


class PublicMarketplaceProductSerializer(serializers.BaseSerializer):
    def to_representation(self, product: MarketplaceProduct):
        return _annotate_product_public(product, expose_platform_base=False)


def _active_scheme_offerings(jeweller) -> list[dict]:
    try:
        from apps.schemes.models import JewellerSchemeOffering

        qs = (
            JewellerSchemeOffering.objects.filter(
                jeweller=jeweller,
                status=JewellerSchemeOffering.STATUS_ACTIVE,
            )
            .select_related("scheme_template")
            .order_by("scheme_template__sort_order", "display_name")
        )
        return [
            {
                "id": o.id,
                "display_name": o.display_name or o.scheme_template.name,
                "flow_summary": o.scheme_template.flow_summary,
                "category": o.scheme_template.category,
                "template_slug": o.scheme_template.slug,
            }
            for o in qs
        ]
    except Exception:
        return []


def _golden_scheme_storefront_summary(profile: JewellerPricingProfile) -> str:
    if not profile.golden_scheme_enabled:
        return ""
    parts: list[str] = []
    if profile.golden_scheme_duration_months:
        parts.append(f"{profile.golden_scheme_duration_months}-month plan")
    if (
        profile.golden_scheme_min_monthly_inr is not None
        and profile.golden_scheme_min_monthly_inr > 0
    ):
        parts.append(f"from ₹{profile.golden_scheme_min_monthly_inr}/mo")
    return " · ".join(parts) if parts else "Golden Scheme — see showroom"


def public_jeweller_storefront(user) -> dict:
    profile = jeweller_profile_for(user)
    ticker = get_or_create_ticker()
    cridora_base, _ = resolve_cridora_base_22k_inr()
    store_22 = jeweller_store_22k_inr(profile, cridora_base)
    ref_metal = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
    buyback = jeweller_buyback_display_inr_per_gram(profile, cridora_base)
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
        "jeweller_metal_rate_last_updated_at": jeweller_rate_effective_updated_at(
            profile
        ).isoformat(),
        "jeweller_store_22k_inr_per_gram": str(store_22),
        "gold_rate_source": profile.gold_rate_source,
        "representative_making_charge_inr_per_gram": str(
            profile.representative_making_charge_inr_per_gram
        ),
        "buyback_indicative_inr_per_gram": str(buyback),
        "buyback_uses_headline_override": bool(
            profile.buyback_headline_inr_per_gram is not None
            and profile.buyback_headline_inr_per_gram > 0
        ),
        "reference_metal_inr_per_gram": str(ref_metal),
        "gold_deposit_yield_apr_percent": str(ticker.gold_deposit_yield_apr_percent),
        "gold_loan_interest_apr_percent": str(ticker.gold_loan_interest_apr_percent),
        "gold_loan_processing_fee_percent": str(ticker.gold_loan_processing_fee_percent),
        "gold_loan_ltv_min_percent": str(ticker.gold_loan_ltv_min_percent),
        "gold_loan_ltv_max_percent": str(ticker.gold_loan_ltv_max_percent),
        "gold_loan_ltv_percent": (
            str(profile.gold_loan_ltv_percent)
            if profile.gold_loan_ltv_percent is not None
            else ""
        ),
        "gold_loan_jeweller_deduction_inr_per_gram": str(
            profile.gold_loan_jeweller_deduction_inr_per_gram
        ),
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
        "golden_scheme_enabled": profile.golden_scheme_enabled,
        "golden_scheme_summary": _golden_scheme_storefront_summary(profile),
        "golden_scheme_duration_months": (
            str(profile.golden_scheme_duration_months)
            if profile.golden_scheme_duration_months
            else ""
        ),
        "golden_scheme_min_monthly_inr": (
            str(profile.golden_scheme_min_monthly_inr)
            if profile.golden_scheme_min_monthly_inr is not None
            else ""
        ),
        "golden_scheme_lock_in_note": profile.golden_scheme_lock_in_note or "",
        "golden_scheme_benefits": profile.golden_scheme_benefits or "",
        "golden_scheme_rate_application_note": profile.golden_scheme_rate_application_note
        or "",
        "active_scheme_offerings": _active_scheme_offerings(profile.jeweller),
    }


class JewellerProductWriteSerializer(serializers.ModelSerializer):
    product_category = serializers.PrimaryKeyRelatedField(
        queryset=ProductCategory.objects.filter(is_active=True)
    )
    metal_purity = serializers.PrimaryKeyRelatedField(
        queryset=MetalPurity.objects.filter(is_active=True)
    )
    stock_quantity = serializers.IntegerField(min_value=0, required=False)

    class Meta:
        model = MarketplaceProduct
        fields = (
            "name",
            "product_category",
            "metal_purity",
            "stock_quantity",
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
            "same_store_making_charge_percent",
            "same_store_making_charge_per_gram",
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
            ss_pct = attrs.get(
                "same_store_making_charge_percent",
                getattr(self.instance, "same_store_making_charge_percent", None),
            )
            if ss_pct is not None:
                if ss_pct < Decimal("0") or ss_pct > Decimal("100"):
                    raise serializers.ValidationError(
                        {
                            "same_store_making_charge_percent": "Must be between 0 and 100."
                        }
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
            ss_pg = attrs.get(
                "same_store_making_charge_per_gram",
                getattr(self.instance, "same_store_making_charge_per_gram", None),
            )
            if ss_pg is not None and ss_pg < Decimal("0"):
                raise serializers.ValidationError(
                    {
                        "same_store_making_charge_per_gram": "Must be zero or greater."
                    }
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

        req = self.context.get("request")
        if req and getattr(req.user, "is_authenticated", False):
            profile = jeweller_profile_for(req.user)
            mp = attrs.get("metal_purity") or (
                self.instance.metal_purity if self.instance else None
            )
            if mp is not None:
                allowed = allowed_metal_purities_qs(profile)
                if not allowed.filter(pk=mp.pk).exists():
                    raise serializers.ValidationError(
                        {
                            "metal_purity": (
                                "This purity is not enabled for your storefront. "
                                "Select it under Catalogue · Metal purities offered."
                            )
                        }
                    )
            pc = attrs.get("product_category") or (
                self.instance.product_category if self.instance else None
            )
            if pc is not None and not pc.is_active:
                raise serializers.ValidationError(
                    {"product_category": "This category is not available."}
                )

        return attrs

    def update(self, instance, validated_data):
        if "image_url" in validated_data:
            delete_replaced_media_url(
                old_url=instance.image_url,
                new_url=validated_data["image_url"],
            )
        return super().update(instance, validated_data)


class JewellerProductReadSerializer(serializers.BaseSerializer):
    def to_representation(self, product: MarketplaceProduct):
        base = _annotate_product_public(product, expose_platform_base=True)
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
        row = _annotate_product_public(product, expose_platform_base=True)
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
