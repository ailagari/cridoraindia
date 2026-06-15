"""Preset scheme designs for admin quick-start chips."""

from __future__ import annotations

PRESETS: dict[str, dict] = {
    "eleven_plus_one_jewellery_pool": {
        "key": "eleven_plus_one_jewellery_pool",
        "label": "11+1 Jewellery Pool",
        "description": "Cash anytime for 11 months; jeweller adds avg month 12; redeem as jewellery bill.",
        "design": {
            "input": {
                "payment_type": "cash",
                "includes_gst": False,
                "gst_percent": 3,
                "includes_making_charge": False,
                "making_charge_mode": "none",
                "min_deposit_inr": None,
                "max_deposit_inr": None,
                "suggested_rhythm": "anytime",
            },
            "plan_timeline": {
                "fixed_duration": True,
                "customer_months": 11,
                "jeweller_bonus_month": 12,
                "redemption_from": "after_bonus",
                "bonus_enabled": True,
                "bonus_amount_mode": "avg_all_months",
                "bonus_avg_months": 11,
                "bonus_fixed_inr": None,
                "bonus_credit_as": "cash_pool",
                "after_plan_ends": "new_cycle",
            },
            "output": {
                "redeem_as": "jewellery_cash_pool",
                "making_charge": "full",
                "making_charge_percent": None,
                "gst": "full",
                "allow_topup": True,
                "lock_until_plan_complete": True,
            },
            "jeweller_can_override": ["min_deposit_inr", "display_name"],
        },
    },
    "open_fractional_gold": {
        "key": "open_fractional_gold",
        "label": "Open Fractional Gold",
        "description": "Gold deposits anytime with GST and making charge; redeem vault gold.",
        "design": {
            "input": {
                "payment_type": "gold",
                "includes_gst": True,
                "gst_percent": 3,
                "includes_making_charge": True,
                "making_charge_mode": "jeweller_per_gram",
                "includes_gst_on_making_charge": True,
                "gst_on_making_charge_percent": 18,
                "min_deposit_inr": 100,
                "max_deposit_inr": None,
                "suggested_rhythm": "anytime",
            },
            "plan_timeline": {
                "fixed_duration": False,
                "customer_months": None,
                "jeweller_bonus_month": None,
                "redemption_from": "anytime",
                "bonus_enabled": False,
                "bonus_amount_mode": "avg_all_months",
                "bonus_avg_months": None,
                "bonus_fixed_inr": None,
                "bonus_credit_as": "gold_grams",
                "after_plan_ends": "redeem_only",
            },
            "output": {
                "redeem_as": "gold_grams",
                "making_charge": "reduced_percent",
                "making_charge_percent": None,
                "gst": "vault_relief",
                "allow_topup": False,
                "lock_until_plan_complete": False,
            },
            "jeweller_can_override": [
                "min_deposit_inr",
                "redemption_making_charge_percent",
                "display_name",
            ],
        },
    },
    "eleven_plus_one_avg_six_gold": {
        "key": "eleven_plus_one_avg_six_gold",
        "label": "11+1 Avg-6 Gold",
        "description": "Cash anytime 11 months; bonus avg last 6; convert to gold at redemption with 0% MC.",
        "design": {
            "input": {
                "payment_type": "cash",
                "includes_gst": False,
                "gst_percent": 3,
                "includes_making_charge": False,
                "making_charge_mode": "none",
                "min_deposit_inr": None,
                "max_deposit_inr": None,
                "suggested_rhythm": "anytime",
            },
            "plan_timeline": {
                "fixed_duration": True,
                "customer_months": 11,
                "jeweller_bonus_month": 12,
                "redemption_from": "after_bonus",
                "bonus_enabled": True,
                "bonus_amount_mode": "avg_last_n_months",
                "bonus_avg_months": 6,
                "bonus_fixed_inr": None,
                "bonus_credit_as": "cash_pool",
                "after_plan_ends": "new_cycle",
            },
            "output": {
                "redeem_as": "cash_convert_to_gold",
                "making_charge": "zero",
                "making_charge_percent": 0,
                "gst": "vault_relief",
                "allow_topup": False,
                "lock_until_plan_complete": True,
            },
            "jeweller_can_override": ["min_deposit_inr", "display_name"],
        },
    },
    "eleven_plus_one_flexi_bonus": {
        "key": "eleven_plus_one_flexi_bonus",
        "label": "11+1 Flexi Bonus",
        "description": "Gold monthly buckets; jeweller bonus month 12 as gold or MC credit.",
        "design": {
            "input": {
                "payment_type": "gold",
                "includes_gst": True,
                "gst_percent": 3,
                "includes_making_charge": True,
                "making_charge_mode": "jeweller_per_gram",
                "includes_gst_on_making_charge": True,
                "gst_on_making_charge_percent": 18,
                "min_deposit_inr": 500,
                "max_deposit_inr": None,
                "suggested_rhythm": "anytime",
            },
            "plan_timeline": {
                "fixed_duration": True,
                "customer_months": 11,
                "jeweller_bonus_month": 12,
                "redemption_from": "after_bonus",
                "bonus_enabled": True,
                "bonus_amount_mode": "avg_all_months",
                "bonus_avg_months": 11,
                "bonus_fixed_inr": None,
                "bonus_credit_as": "jeweller_choice",
                "after_plan_ends": "new_cycle",
            },
            "output": {
                "redeem_as": "jewellery_from_gold",
                "making_charge": "mc_credit_first",
                "making_charge_percent": None,
                "gst": "vault_relief",
                "allow_topup": True,
                "lock_until_plan_complete": True,
            },
            "jeweller_can_override": [
                "bonus_credit_as",
                "redemption_making_charge_percent",
                "display_name",
            ],
        },
    },
}


def list_presets() -> list[dict]:
    return [
        {"key": p["key"], "label": p["label"], "description": p["description"]}
        for p in PRESETS.values()
    ]


def preset_design(key: str) -> dict | None:
    row = PRESETS.get(key)
    return dict(row["design"]) if row else None
