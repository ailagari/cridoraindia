"""Compile graphical scheme_design into internal scheme_rules."""

from __future__ import annotations

from typing import Any


def _deep_get(d: dict, *keys: str, default=None):
    cur: Any = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
    return cur if cur is not None else default


def validate_scheme_design(design: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(design, dict):
        return ["scheme_design must be an object."]

    payment_type = _deep_get(design, "input", "payment_type")
    if payment_type not in ("cash", "gold"):
        errors.append("input.payment_type must be cash or gold.")

    redeem_as = _deep_get(design, "output", "redeem_as")
    if redeem_as not in (
        "jewellery_cash_pool",
        "gold_grams",
        "jewellery_from_gold",
        "cash_convert_to_gold",
    ):
        errors.append("output.redeem_as is invalid.")

    if payment_type == "cash" and redeem_as == "gold_grams":
        errors.append(
            "Cash input with direct gold redemption requires cash_convert_to_gold output."
        )

    fixed = _deep_get(design, "plan_timeline", "fixed_duration", default=False)
    if fixed:
        cm = _deep_get(design, "plan_timeline", "customer_months")
        bm = _deep_get(design, "plan_timeline", "jeweller_bonus_month")
        if not cm or cm < 1:
            errors.append("plan_timeline.customer_months is required for fixed plans.")
        if _deep_get(design, "plan_timeline", "bonus_enabled") and (not bm or bm <= cm):
            errors.append(
                "jeweller_bonus_month must be greater than customer_months when bonus enabled."
            )

    bonus_mode = _deep_get(design, "plan_timeline", "bonus_amount_mode")
    if bonus_mode == "avg_last_n_months":
        n = _deep_get(design, "plan_timeline", "bonus_avg_months")
        if not n or n < 1:
            errors.append("bonus_avg_months required for avg_last_n_months.")

    return errors


def compile_scheme_design(design: dict) -> dict:
    """Map admin graphical design to engine rules."""
    inp = design.get("input") or {}
    timeline = design.get("plan_timeline") or {}
    out = design.get("output") or {}

    payment_type = inp.get("payment_type", "cash")
    credit_mode = "gold_grams" if payment_type == "gold" else "inr_pool"

    fixed = bool(timeline.get("fixed_duration"))
    customer_months = timeline.get("customer_months") if fixed else None
    bonus_month = timeline.get("jeweller_bonus_month") if fixed else None

    redeem_as = out.get("redeem_as", "jewellery_cash_pool")
    if redeem_as == "cash_convert_to_gold":
        redemption_mode = "gold_grams_from_inr_pool"
    elif redeem_as == "jewellery_from_gold":
        redemption_mode = "jewellery_from_gold"
    elif redeem_as == "gold_grams":
        redemption_mode = "gold_grams"
    else:
        redemption_mode = "jewellery_inr_pool"

    mc_map = {
        "full": "full",
        "reduced_percent": "reduced_percent",
        "zero": "zero",
        "mc_credit_first": "mc_credit_first",
    }
    gst_map = {
        "full": "full",
        "none_on_metal": "none_on_metal",
        "vault_relief": "vault_relief",
    }

    bonus_mode = timeline.get("bonus_amount_mode", "avg_all_months")
    bonus_formula = {
        "avg_all_months": "avg_monthly_buckets_all",
        "avg_last_n_months": "avg_monthly_buckets_last_n",
        "equal_last_month": "equal_last_month_bucket",
        "fixed_inr": "fixed_inr",
    }.get(bonus_mode, "avg_monthly_buckets_all")

    return {
        "deposit_mode": "anytime",
        "timing": "calendar_month",
        "contribution": {
            "credit_mode": credit_mode,
            "includes_gst": bool(inp.get("includes_gst")),
            "gst_percent": float(inp.get("gst_percent") or 3),
            "includes_making_charge": bool(inp.get("includes_making_charge")),
            "making_charge_mode": inp.get("making_charge_mode") or "none",
            "min_deposit_inr": inp.get("min_deposit_inr"),
            "max_deposit_inr": inp.get("max_deposit_inr"),
            "suggested_rhythm": inp.get("suggested_rhythm"),
        },
        "cycle": {
            "enabled": fixed,
            "customer_months": customer_months,
            "jeweller_bonus_month": bonus_month,
            "overflow_action": timeline.get("after_plan_ends") or "new_cycle",
        },
        "bonus": {
            "enabled": bool(timeline.get("bonus_enabled")) and fixed,
            "formula": bonus_formula,
            "avg_months": timeline.get("bonus_avg_months"),
            "fixed_inr": timeline.get("bonus_fixed_inr"),
            "credit_as": timeline.get("bonus_credit_as") or "cash_pool",
            "redemption_from": timeline.get("redemption_from") or "after_bonus",
        },
        "redemption": {
            "mode": redemption_mode,
            "making_charge": mc_map.get(out.get("making_charge"), "full"),
            "making_charge_percent": out.get("making_charge_percent"),
            "gst": gst_map.get(out.get("gst"), "full"),
            "allow_topup": bool(out.get("allow_topup")),
            "lock_until_plan_complete": bool(out.get("lock_until_plan_complete")),
        },
        "jeweller_overrides_allowed": design.get("jeweller_can_override") or [],
    }


def human_flow_summary(design: dict) -> str:
    inp = design.get("input") or {}
    timeline = design.get("plan_timeline") or {}
    out = design.get("output") or {}

    pay = "Gold" if inp.get("payment_type") == "gold" else "Cash"
    parts = [f"{pay} deposits anytime"]

    if timeline.get("fixed_duration"):
        cm = timeline.get("customer_months")
        bm = timeline.get("jeweller_bonus_month")
        parts.append(f"{cm} saving months")
        if timeline.get("bonus_enabled") and bm:
            mode = timeline.get("bonus_amount_mode", "avg_all_months")
            if mode == "avg_last_n_months":
                n = timeline.get("bonus_avg_months")
                parts.append(f"jeweller bonus month {bm} (avg last {n} months)")
            else:
                parts.append(f"jeweller bonus month {bm}")

    redeem_labels = {
        "jewellery_cash_pool": "jewellery purchase",
        "gold_grams": "gold grams",
        "jewellery_from_gold": "jewellery from gold",
        "cash_convert_to_gold": "gold at redemption",
    }
    parts.append(f"redeem as {redeem_labels.get(out.get('redeem_as'), 'jewellery')}")

    if out.get("making_charge") == "zero":
        parts.append("0% MC")
    elif out.get("making_charge") == "mc_credit_first":
        parts.append("MC credit first")

    return " · ".join(parts)


def preview_calculation(design: dict, sample_deposit_inr: float = 5000) -> dict:
    """Worked example for admin live preview."""
    from decimal import Decimal

    from .unified_scheme_engine import UnifiedSchemeEngine

    rules = compile_scheme_design(design)
    engine = UnifiedSchemeEngine(rules)
    quote = engine.quote_deposit(Decimal(str(sample_deposit_inr)), jeweller_mc_per_gram=Decimal("50"))

    timeline = design.get("plan_timeline") or {}
    cm = timeline.get("customer_months") or 11
    monthly = float(sample_deposit_inr)
    bonus_monthly_avg = monthly
    if timeline.get("bonus_amount_mode") == "avg_last_n_months":
        n = timeline.get("bonus_avg_months") or 6
        bonus_monthly_avg = monthly
        bonus_label = f"avg last {n} months ≈ ₹{bonus_monthly_avg:,.0f}"
    else:
        bonus_label = f"avg all {cm} months ≈ ₹{bonus_monthly_avg:,.0f}"

    pool_total = monthly * cm + bonus_monthly_avg

    flow_nodes = [
        {"id": "input", "label": "Customer pays anytime", "detail": quote.get("summary", "")},
    ]
    if timeline.get("fixed_duration") and timeline.get("bonus_enabled"):
        flow_nodes.append(
            {
                "id": "bonus",
                "label": f"Month {timeline.get('jeweller_bonus_month')} jeweller bonus",
                "detail": bonus_label,
            }
        )
    out = design.get("output") or {}
    flow_nodes.append(
        {
            "id": "output",
            "label": "Redemption",
            "detail": f"Pool ≈ ₹{pool_total:,.0f}" if rules["contribution"]["credit_mode"] == "inr_pool" else "Vault gold balance",
        }
    )

    return {
        "flow_nodes": flow_nodes,
        "deposit_quote": quote,
        "example": {
            "sample_deposit_inr": sample_deposit_inr,
            "customer_months": cm,
            "estimated_pool_inr": pool_total,
            "bonus_label": bonus_label,
        },
        "flow_summary": human_flow_summary(design),
    }
