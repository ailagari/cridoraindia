"""Admin-facing documentation for Engagement Engine templates (API + UI)."""

from __future__ import annotations

from apps.accounts.services.engagement_constants import CONTEXTS, MOMENTS, VARIABLE_CATALOG

FORMATTING_RULES = [
    "Use double curly braces for variables: {{holding_name}}, {{portfolio_value}}.",
    "Only listed variables are substituted; unknown keys stay as-is in preview.",
    "No HTML, scripts, or Jinja — plain text only.",
    "Title: keep under 45 characters for tray push; inbox allows up to 180.",
    "Body: aim under 120 characters for tray; longer text may truncate on push.",
    "Each row is unique by moment (category) + context + locale — duplicate combinations will fail on save.",
    "Set is_active=false to retire copy without deleting history.",
    "Deploy code only when adding new moments or variables; wording changes are DB-only.",
]

MOMENT_GUIDES: dict[str, dict] = {
    "portfolio_growth": {
        "label": "Portfolio growth",
        "when_fires": "After gold price ingest, when total portfolio gain vs cost exceeds ticker thresholds (event-driven).",
        "audience": "Customers with portfolio activity; respects allow_portfolio_alerts and daily portfolio cap.",
        "suggested_variables": [
            "first_name",
            "portfolio_gain_amount",
            "portfolio_gain_percent",
            "portfolio_value",
        ],
        "title_example": "Portfolio value update",
        "body_example": (
            "Your gold portfolio gained an estimated {{portfolio_gain_amount}} in value."
        ),
    },
    "portfolio_milestone": {
        "label": "Portfolio milestone",
        "when_fires": "When estimated portfolio value crosses a threshold in Gold ticker portfolio_milestone_thresholds_inr.",
        "audience": "Same as portfolio growth; fires once per threshold band crossed.",
        "suggested_variables": ["first_name", "portfolio_value", "portfolio_gain_amount"],
        "title_example": "Portfolio milestone",
        "body_example": "Your portfolio crossed {{portfolio_value}} in estimated value.",
    },
    "holding_appreciation": {
        "label": "Holding appreciation",
        "when_fires": "Per personal holding when gain vs last notified value exceeds holding_gain_threshold_inr (gain-only).",
        "audience": "Holding owner; 24h cooldown per item; shares gold daily alert cap.",
        "suggested_variables": [
            "holding_name",
            "holding_gain_amount",
            "holding_value",
            "years_held",
            "purchase_date",
        ],
        "title_example": "Portfolio value update",
        "body_example": (
            "Your {{holding_name}} is now {{holding_gain_amount}} higher in estimated value "
            "— now about {{holding_value}}."
        ),
    },
    "holding_milestone": {
        "label": "Holding milestone",
        "when_fires": "When a single holding's estimated value crosses holding_milestone_threshold_inr.",
        "audience": "Holding owner; once per holding when value crosses threshold.",
        "suggested_variables": [
            "holding_name",
            "holding_value",
            "purchase_date",
            "years_held",
        ],
        "title_example": "Holding milestone",
        "body_example": "Your {{holding_name}} is now valued at {{holding_value}}.",
    },
    "market_awareness": {
        "label": "Market awareness",
        "when_fires": "Platform or jeweller gold rate move past threshold; also educational variant on ingest.",
        "audience": "Customers with holdings (platform) or jeweller customers (jeweller rate).",
        "suggested_variables": ["gold_price", "gold_change_percent", "monthly_change"],
        "title_example": "Gold rate alert",
        "body_example": "Gold rate moved {{gold_change_percent}} — reference is now {{gold_price}}.",
    },
}

CONTEXT_GUIDES: dict[str, dict] = {
    "default": {
        "label": "Default",
        "use_when": "Everyday tone for ingest-driven portfolio, holding, and market alerts.",
        "set_via": "Fallback when no festival window or campaign override is active.",
    },
    "festival": {
        "label": "Festival",
        "use_when": "Seasonal storytelling (Vishu, Onam, Diwali, etc.).",
        "set_via": "Gold tab: Active engagement context = festival + Festival name; or campaign festival_name field.",
        "note": "Use {{festival_name}} and optional {{festival_message}} — do not create separate contexts per holiday.",
    },
    "jeweller_campaign": {
        "label": "Jeweller campaign",
        "use_when": "Scheduled messages from a jeweller to their customers.",
        "set_via": "Campaign engagement_context or jeweller API campaigns endpoint.",
    },
    "educational": {
        "label": "Educational",
        "use_when": "“Did you know?” style market_awareness (max once per user per month).",
        "set_via": "Gold tab: enable Educational market awareness on ingest.",
        "note": "Pair with moment market_awareness only.",
    },
}

USE_CASES = [
    {
        "title": "Festival season (Vishu / Onam)",
        "steps": [
            "Set Gold tab → Active context = festival, Festival name = Vishu (or Onam).",
            "Edit or duplicate template: holding_appreciation + festival + en.",
            "Trigger ingest (Send price notification) or wait for live rate change.",
        ],
        "sample_key": "holding_appreciation/festival/en",
    },
    {
        "title": "Portfolio crossed ₹1 lakh",
        "steps": [
            "Gold tab → portfolio_milestone_thresholds_inr includes 100000.",
            "Edit template portfolio_milestone + default + en.",
            "Customer portfolio value must cross threshold on next ingest.",
        ],
        "sample_key": "portfolio_milestone/default/en",
    },
    {
        "title": "Personalized festival campaign",
        "steps": [
            "Campaigns tab → engagement_context=festival, engagement_moment=holding_appreciation.",
            "festival_name=Diwali, personalize per user = on.",
            "Schedule; process_festival_broadcasts delivers per-customer facts.",
        ],
        "sample_key": "holding_appreciation/festival/en",
    },
    {
        "title": "Malayalam portfolio alert",
        "steps": [
            "Create or edit portfolio_growth + default + ml.",
            "Same moment fires as English; locale selects template row.",
        ],
        "sample_key": "portfolio_growth/default/ml",
    },
]

SAMPLE_TEMPLATES = [
    {
        "name": "Portfolio growth (EN)",
        "category": "portfolio_growth",
        "context": "default",
        "locale": "en",
        "title_template": "Portfolio value update",
        "body_template": "Your gold portfolio gained an estimated {{portfolio_gain_amount}} in value.",
        "variables": ["portfolio_gain_amount", "portfolio_value", "first_name"],
    },
    {
        "name": "Holding appreciation — festival",
        "category": "holding_appreciation",
        "context": "festival",
        "locale": "en",
        "title_template": "Portfolio value update",
        "body_template": (
            "This {{festival_name}}, your {{holding_name}} is worth {{holding_value}}. "
            "{{festival_message}}"
        ),
        "variables": ["festival_name", "festival_message", "holding_name", "holding_value"],
    },
    {
        "name": "Market — educational",
        "category": "market_awareness",
        "context": "educational",
        "locale": "en",
        "title_template": "Did you know?",
        "body_template": (
            "Gold moved {{gold_change_percent}} recently. "
            "Your portfolio gained {{portfolio_gain_month_inr}} this month ({{month_label}})."
        ),
        "variables": ["gold_change_percent", "portfolio_gain_month_inr", "month_label"],
    },
]


def engagement_admin_guide_payload() -> dict:
    moments = []
    for key in MOMENTS:
        g = MOMENT_GUIDES.get(key, {})
        moments.append({"key": key, **g})
    contexts = []
    for key in CONTEXTS:
        g = CONTEXT_GUIDES.get(key, {})
        contexts.append({"key": key, **g})
    return {
        "moments": list(MOMENTS),
        "contexts": list(CONTEXTS),
        "variables": VARIABLE_CATALOG,
        "formatting_rules": FORMATTING_RULES,
        "moment_guides": moments,
        "context_guides": contexts,
        "use_cases": USE_CASES,
        "sample_templates": SAMPLE_TEMPLATES,
    }
