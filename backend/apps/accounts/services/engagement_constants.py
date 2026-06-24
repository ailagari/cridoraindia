"""Engagement Engine moment and context identifiers."""

from __future__ import annotations

MOMENT_PORTFOLIO_GROWTH = "portfolio_growth"
MOMENT_PORTFOLIO_MILESTONE = "portfolio_milestone"
MOMENT_PORTFOLIO_VALUE_UP = "portfolio_value_up"
MOMENT_PORTFOLIO_VALUE_DOWN = "portfolio_value_down"
MOMENT_PERSONAL_COLLECTION_GROWTH = "personal_collection_growth"
MOMENT_PERSONAL_COLLECTION_DOWN = "personal_collection_down"
MOMENT_HOLDING_APPRECIATION = "holding_appreciation"
MOMENT_HOLDING_VALUE_DOWN = "holding_value_down"
MOMENT_HOLDING_MILESTONE = "holding_milestone"
MOMENT_MARKET_AWARENESS = "market_awareness"
MOMENT_MARKET_RATE_UP = "market_rate_increase"
MOMENT_MARKET_RATE_DOWN = "market_rate_decrease"

MOMENTS = (
    MOMENT_PORTFOLIO_GROWTH,
    MOMENT_PORTFOLIO_MILESTONE,
    MOMENT_PORTFOLIO_VALUE_UP,
    MOMENT_PORTFOLIO_VALUE_DOWN,
    MOMENT_PERSONAL_COLLECTION_GROWTH,
    MOMENT_PERSONAL_COLLECTION_DOWN,
    MOMENT_HOLDING_APPRECIATION,
    MOMENT_HOLDING_VALUE_DOWN,
    MOMENT_HOLDING_MILESTONE,
    MOMENT_MARKET_AWARENESS,
    MOMENT_MARKET_RATE_UP,
    MOMENT_MARKET_RATE_DOWN,
)

CONTEXT_DEFAULT = "default"
CONTEXT_FESTIVAL = "festival"
CONTEXT_JEWELLER_CAMPAIGN = "jeweller_campaign"
CONTEXT_EDUCATIONAL = "educational"

CONTEXTS = (
    CONTEXT_DEFAULT,
    CONTEXT_FESTIVAL,
    CONTEXT_JEWELLER_CAMPAIGN,
    CONTEXT_EDUCATIONAL,
)

DEFAULT_LOCALE = "en"

VARIABLE_CATALOG: dict[str, list[str]] = {
    "user": ["first_name", "city", "member_since"],
    "portfolio": [
        "portfolio_value",
        "portfolio_gain_amount",
        "portfolio_gain_percent",
        "portfolio_weight",
        "value_change_amount",
        "personal_collection_value",
        "personal_collection_gain",
        "personal_collection_loss",
        "rate_direction",
    ],
    "holding": [
        "holding_name",
        "holding_category",
        "holding_value",
        "holding_gain_amount",
        "holding_gain_percent",
        "holding_loss_amount",
        "purchase_date",
        "holding_age_days",
        "years_held",
    ],
    "market": ["gold_price", "gold_change_percent", "monthly_change"],
    "festival": ["festival_name", "festival_message"],
    "jeweller": ["jeweller_name", "offer_name", "offer_end_date"],
    "monthly_storytelling": [
        "month_label",
        "portfolio_gain_month_inr",
        "portfolio_gain_month_percent",
        "holding_gain_month_inr",
        "gold_change_month_percent",
        "best_performing_holding_name",
    ],
}
