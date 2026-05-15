from decimal import Decimal

from django.utils import timezone

from .metal_pricing import jeweller_22k_board_follows_live_ticker, jeweller_store_22k_inr, sellback_rate_inr_per_gram
from .models import JewellerPricingProfile, MarketplaceProduct


def jeweller_rate_effective_updated_at(profile: JewellerPricingProfile) -> timezone.datetime:
    """
    Timestamp shown to customers as “rate last updated”.

    Fixed manual board ₹/g: last jeweller pricing profile save.

    Live / relational pricing (match Cridora, markup on live reference, etc.): last platform ticker update —
    markups and deductions apply on top of that reference, so freshness follows the feed.
    """

    from .models import get_or_create_ticker

    ticker = get_or_create_ticker()
    if jeweller_22k_board_follows_live_ticker(profile):
        return ticker.updated_at
    return profile.updated_at


def markup_for_product(product: MarketplaceProduct, profile: JewellerPricingProfile) -> Decimal:
    if product.jeweller_markup_percent is not None:
        return product.jeweller_markup_percent
    return profile.default_gold_markup_percent


def gold_rate_inr_per_gram(
    product: MarketplaceProduct,
    profile: JewellerPricingProfile,
    cridora_base: Decimal,
) -> Decimal:
    if (
        product.pricing_mode == MarketplaceProduct.PRICING_MANUAL_RATE
        and product.manual_gold_rate_inr_per_gram is not None
        and product.manual_gold_rate_inr_per_gram > 0
    ):
        return product.manual_gold_rate_inr_per_gram.quantize(Decimal("0.01"))
    store = jeweller_store_22k_inr(profile, cridora_base)
    m = markup_for_product(product, profile) / Decimal("100")
    return (store * (Decimal("1") + m)).quantize(Decimal("0.01"))


def stone_component_inr(product: MarketplaceProduct) -> Decimal:
    if not product.stone_included or product.stone_cost_inr is None:
        return Decimal("0")
    return max(Decimal("0"), product.stone_cost_inr)


def gold_metal_value_inr(product: MarketplaceProduct, metal_rate: Decimal) -> Decimal:
    purity = getattr(product, "metal_purity", None)
    frac = purity.fine_fraction if purity is not None else Decimal("0.916")
    base = Decimal("0.916")
    adj = frac / base
    return (product.gold_weight_grams * metal_rate * adj).quantize(Decimal("0.01"))


def reference_metal_rate_inr_per_gram_for_jeweller(
    profile: JewellerPricingProfile, cridora_base: Decimal
) -> Decimal:
    store = jeweller_store_22k_inr(profile, cridora_base)
    m = profile.default_gold_markup_percent / Decimal("100")
    return (store * (Decimal("1") + m)).quantize(Decimal("0.01"))


def jeweller_buyback_display_inr_per_gram(
    profile: JewellerPricingProfile, cridora_base: Decimal
) -> Decimal:
    if (
        profile.buyback_headline_inr_per_gram is not None
        and profile.buyback_headline_inr_per_gram > 0
    ):
        return profile.buyback_headline_inr_per_gram.quantize(Decimal("0.01"))
    ref = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
    return sellback_rate_inr_per_gram(ref, profile)
