"""Platform and jeweller gold-loan LTV / processing-fee calculations."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from .models import GoldTickerConfig, JewellerPricingProfile


def validate_ltv_bounds(
    ltv: Decimal,
    ticker: GoldTickerConfig,
) -> str | None:
    if ltv < ticker.gold_loan_ltv_min_percent:
        return (
            f"Loan % must be at least {ticker.gold_loan_ltv_min_percent}% "
            f"(platform minimum)."
        )
    if ltv > ticker.gold_loan_ltv_max_percent:
        return (
            f"Loan % must be at most {ticker.gold_loan_ltv_max_percent}% "
            f"(platform maximum)."
        )
    return None


def jeweller_effective_ltv_percent(
    profile: JewellerPricingProfile,
    ticker: GoldTickerConfig,
) -> Decimal | None:
    if not profile.feat_loan_available:
        return None
    ltv = profile.gold_loan_ltv_percent
    if ltv is None:
        return None
    if validate_ltv_bounds(ltv, ticker) is not None:
        return None
    return ltv


def compute_loan_amounts(
    *,
    grams: Decimal,
    metal_inr_per_gram: Decimal,
    ltv_percent: Decimal,
    processing_fee_percent: Decimal,
    processing_fee_jeweller_share_percent: Decimal,
) -> dict[str, Decimal]:
    collateral = (grams * metal_inr_per_gram).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    gross = (collateral * ltv_percent / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    fee = (gross * processing_fee_percent / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    jeweller_fee = (fee * processing_fee_jeweller_share_percent / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    cridora_fee = fee - jeweller_fee
    net = gross - fee
    return {
        "collateral_value_inr": collateral,
        "gross_principal_inr": gross,
        "processing_fee_inr": fee,
        "processing_fee_jeweller_share_inr": jeweller_fee,
        "processing_fee_cridora_share_inr": cridora_fee,
        "net_disbursement_inr": net,
    }
