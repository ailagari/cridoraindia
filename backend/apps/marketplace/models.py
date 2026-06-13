from decimal import Decimal

from django.conf import settings
from django.db import models


class GoldTickerConfig(models.Model):
    """
    Live metal ticker plus platform fees and storefront disclosures (admin: Ticker & fees).

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
        help_text="Notify when public Cridora 22K reference moves by ≥ this ₹/g vs baseline (requires alerts enabled).",
    )
    rate_move_alerts_enabled = models.BooleanField(
        default=True,
        help_text="When on, subscribers are notified when public 22K reference moves by ≥ threshold.",
    )
    rate_alert_baseline_inr_per_gram_22k = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Previous Cridora reference 22K ₹/g used for alert comparisons (internal).",
    )
    hourly_gold_push_enabled = models.BooleanField(
        default=True,
        help_text="When on, hourly cron may broadcast Web Push comparing 22K reference vs prior hourly snapshot.",
    )
    hourly_gold_push_baseline_inr_per_gram_22k = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Last hourly snapshot of Cridora 22K ₹/g for digest pushes (internal).",
    )
    hourly_gold_push_baseline_recorded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When hourly snapshot baseline was recorded (internal).",
    )
    hourly_gold_push_title = models.CharField(
        max_length=120,
        blank=True,
        default="Gold price update",
        help_text="Title for hourly 22K movement digest pushes.",
    )
    hourly_gold_push_link = models.CharField(
        max_length=512,
        default="/marketplace",
        help_text="In-app path opened when the hourly digest is tapped.",
    )
    rate_move_alert_title = models.CharField(
        max_length=120,
        blank=True,
        default="Gold rate alert",
        help_text="Title for threshold-based 22K reference move alerts.",
    )
    rate_move_alert_link = models.CharField(
        max_length=512,
        default="/marketplace",
        help_text="In-app path opened when a threshold alert is tapped.",
    )
    gold_push_image_url = models.URLField(
        max_length=512,
        blank=True,
        default="",
        help_text="Optional image URL shown on automated gold price alerts (HTTPS recommended).",
    )
    portfolio_gain_threshold_inr = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("500"),
        help_text="Notify customers when portfolio value gain vs cost basis exceeds this ₹ amount.",
    )
    portfolio_gain_threshold_percent = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("2"),
        help_text="Or when gain percentage exceeds this value (whichever triggers first).",
    )
    holding_gain_threshold_inr = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("500"),
        help_text="Per personal holding: notify when estimated value gain vs last notified baseline exceeds this ₹.",
    )
    max_gold_alerts_per_day = models.PositiveSmallIntegerField(
        default=3,
        help_text="Max gold-rate / holding gain inbox+push alerts per customer per day.",
    )
    enable_educational_engagement = models.BooleanField(
        default=False,
        help_text="On gold ingest, allow one educational market_awareness message per user per period.",
    )
    enable_monthly_storytelling_push = models.BooleanField(
        default=False,
        help_text="When on, future monthly digest pushes may send (facts always computed in v1).",
    )
    active_engagement_context = models.CharField(
        max_length=32,
        blank=True,
        default="default",
        help_text="Platform-wide template context for ingest-driven engagement.",
    )
    active_festival_name = models.CharField(
        max_length=120,
        blank=True,
        default="",
    )
    active_festival_message = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )
    engagement_context_starts_at = models.DateTimeField(null=True, blank=True)
    engagement_context_ends_at = models.DateTimeField(null=True, blank=True)
    portfolio_milestone_thresholds_inr = models.JSONField(
        default=list,
        blank=True,
        help_text='List of INR thresholds, e.g. ["100000","500000"].',
    )
    holding_milestone_threshold_inr = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("100000"),
        help_text="Notify when a holding estimated value crosses this INR (once per band).",
    )
    max_portfolio_alerts_per_day = models.PositiveSmallIntegerField(
        default=2,
        help_text="Max portfolio_growth / portfolio_milestone alerts per customer per day.",
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
    gold_loan_processing_fee_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("2"),
        help_text="Platform-disclosed gold loan processing fee (% of loan principal).",
    )
    gold_loan_processing_fee_jeweller_share_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("0"),
        help_text="Share of processing fee (%) paid to jeweller on disbursement; remainder is Cridora revenue.",
    )
    gold_loan_ltv_min_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("95"),
        help_text="Minimum loan-to-value (%) jewellers may offer against custodied vault gold.",
    )
    gold_loan_ltv_max_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("99"),
        help_text="Maximum loan-to-value (%) jewellers may offer against custodied vault gold.",
    )
    gold_loan_max_term_months = models.PositiveSmallIntegerField(
        default=12,
        help_text="Maximum gold loan tenure in months (customer-selectable up to this).",
    )
    cross_platform_fee_inr = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("49.00"),
        help_text="Cridora cross-jeweller platform fee (₹) at checkout for X-redeem listings.",
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
        verbose_name = "Ticker and fees configuration"

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


class GoldTickerReferenceHistory(models.Model):
    """Sampled Cridora 22K ₹/g platform reference over time (for charts)."""

    recorded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    inr_per_gram_22k = models.DecimalField(max_digits=12, decimal_places=2)
    base_source = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        ordering = ["-recorded_at"]
        verbose_name_plural = "Gold ticker reference history"

    def __str__(self) -> str:
        return f"{self.recorded_at.isoformat()} · ₹{self.inr_per_gram_22k}/g"


class GoldRateDailySnapshot(models.Model):
    """One row per calendar day — rolling 1-year 22K reference OHLC + daily change."""

    snapshot_date = models.DateField(unique=True, db_index=True)
    open_inr = models.DecimalField(max_digits=12, decimal_places=2)
    high_inr = models.DecimalField(max_digits=12, decimal_places=2)
    low_inr = models.DecimalField(max_digits=12, decimal_places=2)
    close_inr = models.DecimalField(max_digits=12, decimal_places=2)
    change_inr = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    change_pct = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    base_source = models.CharField(max_length=64, blank=True, default="")
    sample_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-snapshot_date"]
        verbose_name_plural = "Gold rate daily snapshots"

    def __str__(self) -> str:
        return f"{self.snapshot_date.isoformat()} · ₹{self.close_inr}/g"


class AkgsmaBoardRateHistory(models.Model):
    """Sampled AKGSMA Kerala board ₹/g (18K, 22K, 24K, silver) for charts."""

    recorded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    inr_per_gram_22k = models.DecimalField(max_digits=12, decimal_places=2)
    inr_per_gram_18k = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    inr_per_gram_24k = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    silver_999_inr = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    board_date = models.CharField(max_length=32, blank=True, default="")
    source = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        ordering = ["-recorded_at"]
        verbose_name_plural = "AKGSMA board rate history"

    def __str__(self) -> str:
        return f"{self.recorded_at.isoformat()} · 22K ₹{self.inr_per_gram_22k}/g"


class AkgsmaBoardDailySnapshot(models.Model):
    """Daily OHLC for AKGSMA 22K board rate (2-year retention)."""

    snapshot_date = models.DateField(unique=True, db_index=True)
    open_inr_22k = models.DecimalField(max_digits=12, decimal_places=2)
    high_inr_22k = models.DecimalField(max_digits=12, decimal_places=2)
    low_inr_22k = models.DecimalField(max_digits=12, decimal_places=2)
    close_inr_22k = models.DecimalField(max_digits=12, decimal_places=2)
    close_inr_18k = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    close_inr_24k = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    silver_999_inr = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    board_date = models.CharField(max_length=32, blank=True, default="")
    source = models.CharField(max_length=64, blank=True, default="")
    sample_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-snapshot_date"]
        verbose_name_plural = "AKGSMA board daily snapshots"

    def __str__(self) -> str:
        return f"{self.snapshot_date.isoformat()} · 22K ₹{self.close_inr_22k}/g"


class KeralaGoldRateDaily(models.Model):
    """Daily Kerala gold/silver ₹/g for public SEO page (Goodreturns + board feeds)."""

    rate_date = models.DateField(unique=True, db_index=True)
    inr_per_gram_24k = models.DecimalField(max_digits=12, decimal_places=2)
    inr_per_gram_22k = models.DecimalField(max_digits=12, decimal_places=2)
    inr_per_gram_18k = models.DecimalField(max_digits=12, decimal_places=2)
    silver_999_inr = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    source = models.CharField(max_length=64, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-rate_date"]
        verbose_name_plural = "Kerala gold rate daily (public)"

    def __str__(self) -> str:
        return f"{self.rate_date.isoformat()} · 22K ₹{self.inr_per_gram_22k}/g"


class GoldRatesPageConfig(models.Model):
    """Singleton settings for the public Kerala gold rates page (SEO + AdSense)."""

    adsense_enabled = models.BooleanField(
        default=False,
        help_text="When on, active AdSense placements render using the client ID below.",
    )
    adsense_client_id = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Google AdSense publisher ID, e.g. ca-pub-xxxxxxxx.",
    )
    page_title = models.CharField(
        max_length=160,
        blank=True,
        default="Kerala Gold Rate Today — Live 22K, 24K & Silver",
    )
    page_description = models.CharField(
        max_length=320,
        blank=True,
        default="Live Kerala gold and silver rates per gram with 2-year history, charts, and jewellery value calculator.",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Gold rates page config"

    def __str__(self) -> str:
        return "Gold rates page config"


class GoldRatesAdPlacement(models.Model):
    """Manual HTML or AdSense slot on the public gold rates page."""

    MODE_MANUAL = "manual"
    MODE_IMAGE = "image"
    MODE_ADSENSE = "adsense"
    MODE_CHOICES = [
        (MODE_MANUAL, "Manual HTML"),
        (MODE_IMAGE, "Image banner"),
        (MODE_ADSENSE, "Google AdSense"),
    ]

    SLOT_TOP_BANNER = "top_banner"
    SLOT_SIDEBAR = "sidebar"
    SLOT_IN_CONTENT_1 = "in_content_1"
    SLOT_IN_CONTENT_2 = "in_content_2"
    SLOT_FOOTER = "footer"
    SLOT_CHOICES = [
        (SLOT_TOP_BANNER, "Top banner"),
        (SLOT_SIDEBAR, "Sidebar"),
        (SLOT_IN_CONTENT_1, "In content (after rates)"),
        (SLOT_IN_CONTENT_2, "In content (after chart)"),
        (SLOT_FOOTER, "Footer strip"),
    ]

    slot = models.CharField(max_length=32, choices=SLOT_CHOICES, unique=True)
    label = models.CharField(max_length=120, blank=True, default="")
    mode = models.CharField(max_length=16, choices=MODE_CHOICES, default=MODE_MANUAL)
    manual_html = models.TextField(
        blank=True,
        default="",
        help_text="Raw HTML for sponsored blocks (admin-reviewed only).",
    )
    image_url = models.URLField(
        max_length=512,
        blank=True,
        default="",
        help_text="Banner image URL when mode is Image.",
    )
    image_link_url = models.URLField(
        max_length=512,
        blank=True,
        default="",
        help_text="Optional click-through URL for image banners.",
    )
    image_alt = models.CharField(
        max_length=160,
        blank=True,
        default="",
        help_text="Alt text for image banners.",
    )
    adsense_slot_id = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="AdSense ad unit slot ID when mode is AdSense.",
    )
    adsense_format = models.CharField(
        max_length=24,
        blank=True,
        default="auto",
        help_text="AdSense data-ad-format, e.g. auto, horizontal, rectangle.",
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "slot"]
        verbose_name = "Gold rates ad placement"

    def __str__(self) -> str:
        return f"{self.slot} ({self.mode})"


class MetalPurity(models.Model):
    """Admin-managed hallmark / fineness options (Django admin). Jewellers enable subsets on their pricing profile."""

    SPOT_FAMILY_GOLD = "gold"
    SPOT_FAMILY_SILVER = "silver"
    SPOT_FAMILY_CHOICES = [
        (SPOT_FAMILY_GOLD, "Gold"),
        (SPOT_FAMILY_SILVER, "Silver"),
    ]

    slug = models.SlugField(max_length=48, unique=True)
    label = models.CharField(max_length=120)
    fine_fraction = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        default=Decimal("0.9160"),
        help_text="Fine gold fraction vs gross ornament weight (916 → 0.916). Metal quote remains 22K board ₹/g.",
    )
    spot_family = models.CharField(
        max_length=8,
        choices=SPOT_FAMILY_CHOICES,
        default=SPOT_FAMILY_GOLD,
        help_text="Which live ticker ladder to use (gold 22K/24K/… or silver 999/925).",
    )
    spot_key = models.CharField(
        max_length=8,
        default="22K",
        help_text="Key in public spot payload, e.g. 22K, 24K, 999.",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.label


class ProductCategory(models.Model):
    """Admin-managed catalogue categories for marketplace SKUs."""

    slug = models.SlugField(max_length=80, unique=True)
    label = models.CharField(max_length=120)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name_plural = "Product categories"

    def __str__(self):
        return self.label


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

    upi_vpa = models.CharField(
        max_length=128,
        blank=True,
        help_text="Jeweller UPI ID (VPA) for online fractional payments, e.g. shop@okicici.",
    )
    upi_display_name = models.CharField(
        max_length=80,
        blank=True,
        help_text="Payee name shown on UPI apps (optional; defaults to business name).",
    )

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
        help_text="Legacy disclosure — prefer gold_loan_ltv_percent for max loan % of collateral.",
    )
    gold_loan_ltv_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Loan-to-value (%) of vault collateral this jeweller offers; must be within platform min–max.",
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
    metal_purities_offered = models.ManyToManyField(
        MetalPurity,
        blank=True,
        related_name="jeweller_profiles_offering",
        help_text="Purities this showroom sells. Leave empty to allow only BIS 916 when listing SKUs.",
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
    category = models.CharField(
        max_length=80,
        help_text="Denormalized copy of product_category.label for legacy filters.",
    )
    product_category = models.ForeignKey(
        ProductCategory,
        on_delete=models.PROTECT,
        related_name="products",
    )
    metal_purity = models.ForeignKey(
        MetalPurity,
        on_delete=models.PROTECT,
        related_name="products",
    )
    stock_quantity = models.PositiveIntegerField(
        default=1,
        help_text="Units in stock (0 = visible but out of stock).",
    )
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
        help_text="Legacy text line; prefer same_store_making_charge_* for pricing.",
    )
    same_store_making_charge_percent = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="When making_charge_mode is percent: making charge as percent of gold metal for customers whose default jeweller is this listing jeweller.",
    )
    same_store_making_charge_per_gram = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="When making_charge_mode is fixed: MC ₹/g for same-store customers.",
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

    def save(self, *args, **kwargs):
        if self.product_category_id:
            try:
                lbl = self.product_category.label
            except ProductCategory.DoesNotExist:
                lbl = None
            if lbl:
                self.category = str(lbl)[:80]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class GoldRateHistory(models.Model):
    """Platform or jeweller gold rate changes for audit and notifications."""

    jeweller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="gold_rate_history",
        limit_choices_to={"user_type": "jeweller"},
        null=True,
        blank=True,
        help_text="Null for platform Cridora 22K reference moves.",
    )
    previous_rate = models.DecimalField(max_digits=12, decimal_places=2)
    new_rate = models.DecimalField(max_digits=12, decimal_places=2)
    difference = models.DecimalField(max_digits=12, decimal_places=2)
    difference_percentage = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"))
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    effective_from = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"GoldRateHistory(j={self.jeweller_id}, {self.previous_rate}->{self.new_rate})"


def get_or_create_ticker() -> GoldTickerConfig:
    obj, _ = GoldTickerConfig.objects.get_or_create(pk=1)
    return obj


def get_or_create_gold_rates_page_config() -> GoldRatesPageConfig:
    obj, _ = GoldRatesPageConfig.objects.get_or_create(pk=1)
    return obj


DEFAULT_GOLD_RATES_AD_SLOTS = (
    GoldRatesAdPlacement.SLOT_TOP_BANNER,
    GoldRatesAdPlacement.SLOT_SIDEBAR,
    GoldRatesAdPlacement.SLOT_IN_CONTENT_1,
    GoldRatesAdPlacement.SLOT_IN_CONTENT_2,
    GoldRatesAdPlacement.SLOT_FOOTER,
)


DEFAULT_GOLD_RATES_AD_IMAGES = {
    GoldRatesAdPlacement.SLOT_TOP_BANNER: "/ads/gold-rates-top-banner.svg",
    GoldRatesAdPlacement.SLOT_SIDEBAR: "/ads/gold-rates-sidebar.svg",
    GoldRatesAdPlacement.SLOT_IN_CONTENT_1: "/ads/gold-rates-in-content.svg",
    GoldRatesAdPlacement.SLOT_IN_CONTENT_2: "/ads/gold-rates-in-content.svg",
    GoldRatesAdPlacement.SLOT_FOOTER: "/ads/gold-rates-footer.svg",
}


def ensure_default_gold_rates_ad_placements() -> None:
    labels = {
        GoldRatesAdPlacement.SLOT_TOP_BANNER: "Top banner",
        GoldRatesAdPlacement.SLOT_SIDEBAR: "Sidebar",
        GoldRatesAdPlacement.SLOT_IN_CONTENT_1: "After rate cards",
        GoldRatesAdPlacement.SLOT_IN_CONTENT_2: "After chart",
        GoldRatesAdPlacement.SLOT_FOOTER: "Footer strip",
    }
    for idx, slot in enumerate(DEFAULT_GOLD_RATES_AD_SLOTS):
        GoldRatesAdPlacement.objects.get_or_create(
            slot=slot,
            defaults={
                "label": labels.get(slot, slot),
                "sort_order": idx,
                "is_active": True,
                "mode": GoldRatesAdPlacement.MODE_IMAGE,
                "image_url": DEFAULT_GOLD_RATES_AD_IMAGES.get(slot, ""),
                "image_alt": labels.get(slot, slot),
            },
        )


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


def allowed_metal_purities_qs(profile: JewellerPricingProfile):
    qs = profile.metal_purities_offered.filter(is_active=True)
    if qs.exists():
        return qs
    return MetalPurity.objects.filter(slug="bis916", is_active=True)
