from decimal import Decimal

from django.conf import settings
from django.db import models


class GoldTickerConfig(models.Model):
    """
    Platform Cridora reference for metals (₹ per gram).

    Manual mode: admin 22K (optional 24K) is the reference for gold ticker rows.

    Live mode: global spot feed supplies raw ₹/g per metal; admin applies per-metal deduction
    (percent or fixed ₹/g, toggle per metal). Last successful raw snapshot is stored for emergency
    when feed and caches are empty. Legacy reference_price_inr_per_gram_22k is used only if no snapshot exists.
    """

    reference_price_inr_per_gram_22k = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("7245.50"),
        help_text="Legacy fallback raw 22K ₹/g only when no live snapshot exists.",
    )
    admin_markup_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("0"),
        help_text="Deprecated — use live_metal_adjustments_json.",
    )
    admin_markup_inr_per_gram = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Deprecated — use live_metal_adjustments_json.",
    )
    live_metal_adjustments_json = models.JSONField(
        default=dict,
        blank=True,
        help_text='Per-metal deductions from live spot, e.g. {"gold":{"22K":{"mode":"percent","amount":"0.5"}}}.',
    )
    last_good_live_raw_snapshot_json = models.JSONField(
        null=True,
        blank=True,
        help_text="Last raw spot gold/silver ₹/g from feed (unadjusted); used when feed and caches are empty.",
    )
    rate_move_alert_threshold_inr = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("10.00"),
        help_text="Notify subscribers when Cridora reference 22K ₹/g moves by ≥ this vs previous reference. 0 disables.",
    )
    rate_alert_baseline_inr_per_gram_22k = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Previous Cridora reference 22K ₹/g used for alert comparisons (internal).",
    )
    gold_deposit_yield_apr_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("0"),
        help_text="Platform-disclosed gold deposit / saver yield (% APR) shown on jeweller storefronts.",
    )
    gold_loan_interest_apr_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("0"),
        help_text="Platform-disclosed gold-backed loan interest (% APR).",
    )
    gold_loan_processing_fee_inr = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Platform-disclosed one-time processing fee (₹) for gold loans.",
    )
    manual_ticker_enabled = models.BooleanField(
        default=False,
        help_text="When on, public ticker and platform 22K base use manual rates below (overrides live spot).",
    )
    ticker_manual_22k_inr_per_gram = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Manual BIS 916 / 22K ₹ per gram for the ticker when manual mode is on.",
    )
    ticker_manual_24k_inr_per_gram = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional manual 24K ₹/g; if empty, 24K is derived as 22K ÷ 0.916.",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Gold ticker configuration"

    def __str__(self):
        return "GoldTickerConfig"

    def platform_base_inr_per_gram(self) -> Decimal:
        """Best-effort Cridora 22K ₹/g when spot chain returns nothing: snapshot or legacy reference, then deductions."""
        from .metal_ticker_adjustments import adjusted_inr_from_decimal

        snap = self.last_good_live_raw_snapshot_json or {}
        gold = snap.get("gold") if isinstance(snap.get("gold"), dict) else {}
        raw22 = gold.get("22K") if gold else None
        if raw22 is not None:
            return adjusted_inr_from_decimal(Decimal(str(raw22)), family="gold", key="22K", ticker=self)
        return adjusted_inr_from_decimal(self.reference_price_inr_per_gram_22k, family="gold", key="22K", ticker=self)


class JewellerPricingProfile(models.Model):
    """Sellback rules and default spot markup for a jeweller storefront."""

    GOLD_RATE_LIVE_CRIDORA = "live_cridora"
    GOLD_RATE_MANUAL = "manual"
    GOLD_RATE_SOURCE_CHOICES = [
        (GOLD_RATE_LIVE_CRIDORA, "Cridora live 22K (global spot)"),
        (GOLD_RATE_MANUAL, "Manual 22K rate"),
    ]

    jeweller = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="jeweller_pricing_profile",
    )
    gold_rate_source = models.CharField(
        max_length=20,
        choices=GOLD_RATE_SOURCE_CHOICES,
        default=GOLD_RATE_LIVE_CRIDORA,
    )
    manual_gold_rate_inr_per_gram = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Fixed 22K ₹/g for all spot-linked pricing when source is manual.",
    )
    live_markup_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("0"),
        help_text="Percent markup on Cridora live 22K (before default per-SKU markup).",
    )
    live_markup_inr_per_gram = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Extra ₹/g after percent, on Cridora live 22K.",
    )
    default_gold_markup_percent = models.DecimalField(
        max_digits=8, decimal_places=3, default=Decimal("0")
    )
    sellback_deduction_percent = models.DecimalField(
        max_digits=8, decimal_places=3, default=Decimal("0")
    )
    sellback_fixed_inr_per_gram = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0")
    )
    gold_deposit_note = models.TextField(
        blank=True,
        help_text="Shown on marketplace for vault/gold deposit policies.",
    )
    representative_making_charge_inr_per_gram = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Typical making charge (₹/g) used for jeweller comparison cards and sorting.",
    )
    buyback_headline_inr_per_gram = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional headline buyback ₹/g; when empty, indicative buyback is derived from metal rate and sellback deductions.",
    )
    gold_deposit_yield_apr_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("0"),
        help_text="Disclosed annual yield % on gold deposit / saver schemes (storefront only).",
    )
    gold_loan_interest_apr_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("0"),
        help_text="Disclosed annual interest % on gold-backed loans (storefront only).",
    )
    updated_at = models.DateTimeField(auto_now=True)

    logo_url = models.URLField(
        max_length=512,
        blank=True,
        help_text="Shown on jeweller marketplace cards.",
    )
    credibility_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="0–100 trust score for marketplace cards (optional).",
    )
    lock_in_summary = models.CharField(
        max_length=240,
        blank=True,
        help_text="E.g. 30 days · none optional — shown on marketplace card.",
    )
    minimum_redeemable_grams = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        null=True,
        blank=True,
    )
    same_store_mc_benefit = models.CharField(
        max_length=240,
        blank=True,
        help_text="Same-store making charge benefit line (e.g. 0% MC).",
    )
    cross_redemption_fee_note = models.CharField(
        max_length=240,
        blank=True,
        help_text="Cross-jeweller / platform fee disclosure.",
    )
    metric_active_users = models.PositiveIntegerField(default=0)
    metric_total_redeemed_gold_grams = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0"),
    )
    metric_years_active = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        default=Decimal("0"),
    )
    feat_instant_redemption = models.BooleanField(default=False)
    feat_zero_mc_same_store = models.BooleanField(default=False)
    feat_loan_available = models.BooleanField(default=False)
    feat_goldnest_available = models.BooleanField(default=False)
    feat_emergency_funds = models.BooleanField(default=False)
    feat_cross_redemption = models.BooleanField(default=True)
    gold_rate_external_api_url = models.URLField(
        max_length=512,
        blank=True,
        help_text="Optional URL of your gold-rate feed for reference; not fetched automatically by Cridora yet.",
    )
    metal_pricing_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Per-metal pricing modes vs Cridora reference (gold/silver purities).",
    )
    metal_buyback_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Per-metal sellback deduction blocks.",
    )
    gold_loan_jeweller_deduction_inr_per_gram = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Jeweller-disclosed extra ₹/g adjustment vs live loan reference (storefront disclosure).",
    )
    golden_scheme_enabled = models.BooleanField(
        default=False,
        help_text="Jeweller offers a Golden Scheme (monthly jewellery savings) disclosure on storefront.",
    )
    golden_scheme_duration_months = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Typical plan duration in months (MVP disclosure).",
    )
    golden_scheme_min_monthly_inr = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Minimum monthly contribution (₹) disclosed to customers.",
    )
    golden_scheme_lock_in_note = models.CharField(
        max_length=240,
        blank=True,
        help_text="Lock-in / tenure rules for the scheme (customer-facing).",
    )
    golden_scheme_benefits = models.TextField(
        blank=True,
        help_text="Benefits narrative (bonus months, ornament benefits, etc.).",
    )
    golden_scheme_rate_application_note = models.CharField(
        max_length=280,
        blank=True,
        help_text="How gold rate applies e.g. at investment vs redemption (MVP disclosure).",
    )

    def __str__(self):
        return f"PricingProfile({self.jeweller_id})"


class MarketplaceProduct(models.Model):
    PRICING_SPOT_MARKUP = "spot_markup"
    PRICING_MANUAL_RATE = "manual_rate"
    PRICING_MODE_CHOICES = [
        (PRICING_SPOT_MARKUP, "Spot base + markup"),
        (PRICING_MANUAL_RATE, "Manual gold rate / gram"),
    ]

    MOD_PENDING = "pending"
    MOD_APPROVED = "approved"
    MOD_REJECTED = "rejected"
    MODERATION_CHOICES = [
        (MOD_PENDING, "Pending"),
        (MOD_APPROVED, "Approved"),
        (MOD_REJECTED, "Rejected"),
    ]

    jeweller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="marketplace_products",
    )
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=80)
    gold_weight_grams = models.DecimalField(max_digits=10, decimal_places=3)
    MAKING_FIXED_PER_GRAM = "fixed_per_gram"
    MAKING_PERCENT_OF_METAL = "percent_of_metal"
    MAKING_CHARGE_MODE_CHOICES = [
        (MAKING_FIXED_PER_GRAM, "Fixed per gram"),
        (MAKING_PERCENT_OF_METAL, "Percent of gold metal value"),
    ]
    making_charge_mode = models.CharField(
        max_length=24,
        choices=MAKING_CHARGE_MODE_CHOICES,
        default=MAKING_FIXED_PER_GRAM,
    )
    making_charge_per_gram = models.DecimalField(max_digits=12, decimal_places=2)
    making_charge_percent = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="When mode is percent of metal, e.g. 8.5 for 8.5%.",
    )
    image_url = models.URLField(max_length=512)

    pricing_mode = models.CharField(
        max_length=20,
        choices=PRICING_MODE_CHOICES,
        default=PRICING_SPOT_MARKUP,
    )
    jeweller_markup_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Overrides jeweller default spot markup when set.",
    )
    manual_gold_rate_inr_per_gram = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    stone_included = models.BooleanField(default=False)
    stone_type = models.CharField(max_length=120, blank=True)
    stone_weight_grams = models.DecimalField(
        max_digits=10, decimal_places=3, null=True, blank=True
    )
    stone_cost_inr = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )

    is_x_redeem = models.BooleanField(default=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=Decimal("4.5"))

    same_store_benefit_note = models.CharField(
        max_length=255,
        blank=True,
        help_text="Optional per-SKU same-store benefit line on product cards.",
    )

    is_published = models.BooleanField(default=True)
    moderation_status = models.CharField(
        max_length=20,
        choices=MODERATION_CHOICES,
        default=MOD_PENDING,
    )
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name


def get_or_create_ticker() -> GoldTickerConfig:
    obj, _ = GoldTickerConfig.objects.get_or_create(pk=1)
    return obj


def jeweller_profile_for(user):
    profile, _ = JewellerPricingProfile.objects.get_or_create(jeweller=user)
    if not profile.metal_pricing_json:
        from .metal_pricing import populate_metal_json_from_legacy, sync_gold_22k_legacy_fields_from_json

        pop = populate_metal_json_from_legacy(profile)
        profile.metal_pricing_json = pop["pricing"]
        profile.metal_buyback_json = pop["buyback"]
        sync_gold_22k_legacy_fields_from_json(profile)
        profile.save()
    return profile
