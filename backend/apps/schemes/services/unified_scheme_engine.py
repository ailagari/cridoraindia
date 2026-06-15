"""Execute compiled scheme rules for quotes, deposits, bonus, and redemption."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from apps.accounts.fractional_service import fractional_metal_rate_inr_per_gram
from apps.marketplace.gold_billing import (
    GST_ON_GOLD_PERCENT,
    GST_ON_MAKING_PERCENT,
    ornament_redemption_bill_inr,
)

ZERO = Decimal("0")


@dataclass
class SchemeRules:
    raw: dict

    @classmethod
    def from_dict(cls, data: dict) -> SchemeRules:
        return cls(raw=data or {})

    @property
    def contribution(self) -> dict:
        return self.raw.get("contribution") or {}

    @property
    def cycle(self) -> dict:
        return self.raw.get("cycle") or {}

    @property
    def bonus(self) -> dict:
        return self.raw.get("bonus") or {}

    @property
    def redemption(self) -> dict:
        return self.raw.get("redemption") or {}


class UnifiedSchemeEngine:
    def __init__(self, rules: dict | SchemeRules):
        self.rules = rules if isinstance(rules, SchemeRules) else SchemeRules.from_dict(rules)

    def quote_deposit(
        self,
        total_inr: Decimal,
        *,
        jeweller_mc_per_gram: Decimal = ZERO,
        jeweller_mc_percent: Decimal = ZERO,
    ) -> dict[str, Any]:
        c = self.rules.contribution
        rate = fractional_metal_rate_inr_per_gram()

        if c.get("credit_mode") == "gold_grams":
            # Gold deposits always include GST on metal; making GST when MC is in the deposit.
            gst_pct = Decimal(str(c.get("gst_percent") or GST_ON_GOLD_PERCENT))
            scheme_mc_pct = Decimal(str(c.get("making_charge_percent") or 0))
            mc_pct = (
                scheme_mc_pct
                if c.get("making_charge_mode") == "jeweller_percent" and scheme_mc_pct > 0
                else jeweller_mc_percent
            )
            includes_mc = bool(c.get("includes_making_charge"))
            mc_gst_pct = (
                Decimal(str(c.get("gst_on_making_charge_percent") or GST_ON_MAKING_PERCENT))
                if includes_mc
                else ZERO
            )
            b = self._gold_deposit_breakdown(
                total_inr,
                rate,
                metal_gst_pct=gst_pct,
                includes_making_charge=bool(c.get("includes_making_charge")),
                making_charge_mode=c.get("making_charge_mode") or "none",
                mc_percent=mc_pct,
                mc_per_gram=jeweller_mc_per_gram,
                mc_gst_pct=mc_gst_pct,
            )
            mc_inr = b["making_charge_inr"]
            mc_gst_inr = b["gst_on_making_charge_inr"]
            metal_gst = b["gst_inr"]
            summary_parts = [f"₹{total_inr} → {b['grams']}g gold"]
            if mc_inr > 0:
                summary_parts.append(f"MC ₹{mc_inr}")
            if mc_gst_inr > 0:
                summary_parts.append(f"GST on MC ₹{mc_gst_inr}")
            return {
                "payment_type": "gold",
                "metal_rate_inr_per_gram": str(rate),
                "total_inr": str(total_inr),
                "gold_value_inr_pre_gst": str(b["gold_value_inr_pre_gst"]),
                "gst_percent": str(gst_pct),
                "gst_inr": str(metal_gst),
                "gst_on_making_charge_inr": str(mc_gst_inr),
                "making_charge_inr": str(mc_inr),
                "making_charge_percent": str(mc_pct) if mc_pct > 0 else "0",
                "gold_grams": str(b["grams"]),
                "credited_as": "gold_grams",
                "summary": " · ".join(summary_parts),
            }

        return {
            "payment_type": "cash",
            "metal_rate_inr_per_gram": str(rate),
            "total_inr": str(total_inr),
            "gold_value_inr_pre_gst": str(total_inr),
            "gst_percent": "0",
            "gst_inr": "0",
            "gst_on_making_charge_inr": "0",
            "making_charge_inr": "0",
            "gold_grams": "0",
            "credited_as": "cash_pool",
            "summary": f"₹{total_inr} → cash pool",
        }

    @staticmethod
    def _gold_deposit_breakdown(
        total_inr: Decimal,
        rate: Decimal,
        *,
        metal_gst_pct: Decimal,
        includes_making_charge: bool,
        making_charge_mode: str,
        mc_percent: Decimal,
        mc_per_gram: Decimal,
        mc_gst_pct: Decimal,
    ) -> dict[str, Decimal]:
        if rate <= 0:
            raise ValueError("Invalid rate.")

        if includes_making_charge and making_charge_mode == "jeweller_percent" and mc_percent > 0:
            mc_factor = mc_percent / Decimal("100")
            if mc_gst_pct > 0:
                mc_factor *= Decimal("1") + mc_gst_pct / Decimal("100")
            metal_factor = Decimal("1") + metal_gst_pct / Decimal("100")
            gold_pre = (total_inr / (metal_factor + mc_factor)).quantize(Decimal("0.01"))
            metal_gst = (gold_pre * metal_gst_pct / Decimal("100")).quantize(Decimal("0.01"))
            mc_inr = (gold_pre * mc_percent / Decimal("100")).quantize(Decimal("0.01"))
            mc_gst_inr = (
                (mc_inr * mc_gst_pct / Decimal("100")).quantize(Decimal("0.01"))
                if mc_gst_pct > 0
                else ZERO
            )
            grams = (gold_pre / rate).quantize(Decimal("0.000001"))
            return {
                "grams": grams,
                "gold_value_inr_pre_gst": gold_pre,
                "gst_inr": metal_gst,
                "making_charge_inr": mc_inr,
                "gst_on_making_charge_inr": mc_gst_inr,
            }

        if includes_making_charge and making_charge_mode == "jeweller_per_gram" and mc_per_gram > 0:
            metal_factor = Decimal("1") + metal_gst_pct / Decimal("100")
            gold_pre = (total_inr / metal_factor).quantize(Decimal("0.01")) if metal_factor > 0 else total_inr
            grams = (gold_pre / rate).quantize(Decimal("0.000001"))
            mc_inr = (grams * mc_per_gram).quantize(Decimal("0.01"))
            mc_gst_inr = (
                (mc_inr * mc_gst_pct / Decimal("100")).quantize(Decimal("0.01"))
                if mc_gst_pct > 0
                else ZERO
            )
            remaining = max(ZERO, total_inr - mc_inr - mc_gst_inr)
            if metal_gst_pct > 0:
                gold_pre = (remaining / metal_factor).quantize(Decimal("0.01"))
                metal_gst = (remaining - gold_pre).quantize(Decimal("0.01"))
            else:
                gold_pre = remaining.quantize(Decimal("0.01"))
                metal_gst = ZERO
            grams = (gold_pre / rate).quantize(Decimal("0.000001"))
            mc_inr = (grams * mc_per_gram).quantize(Decimal("0.01"))
            mc_gst_inr = (
                (mc_inr * mc_gst_pct / Decimal("100")).quantize(Decimal("0.01"))
                if mc_gst_pct > 0
                else ZERO
            )
            return {
                "grams": grams,
                "gold_value_inr_pre_gst": gold_pre,
                "gst_inr": metal_gst,
                "making_charge_inr": mc_inr,
                "gst_on_making_charge_inr": mc_gst_inr,
            }

        metal_factor = Decimal("1") + metal_gst_pct / Decimal("100")
        gold_pre = (total_inr / metal_factor).quantize(Decimal("0.01")) if metal_gst_pct > 0 else total_inr.quantize(Decimal("0.01"))
        metal_gst = (total_inr - gold_pre).quantize(Decimal("0.01")) if metal_gst_pct > 0 else ZERO
        grams = (gold_pre / rate).quantize(Decimal("0.000001"))
        return {
            "grams": grams,
            "gold_value_inr_pre_gst": gold_pre,
            "gst_inr": metal_gst,
            "making_charge_inr": ZERO,
            "gst_on_making_charge_inr": ZERO,
        }

    def validate_deposit_amount(
        self,
        total_inr: Decimal,
        *,
        offering_overrides: dict | None = None,
    ) -> str | None:
        c = self.rules.contribution
        ov = offering_overrides or {}
        min_inr = ov.get("min_deposit_inr") or c.get("min_deposit_inr")
        max_inr = ov.get("max_deposit_inr") or c.get("max_deposit_inr")
        if min_inr is not None and total_inr < Decimal(str(min_inr)):
            return f"Minimum deposit is ₹{min_inr}."
        if max_inr is not None and total_inr > Decimal(str(max_inr)):
            return f"Maximum deposit is ₹{max_inr}."
        if total_inr <= 0:
            return "Amount must be positive."
        return None

    def compute_bonus_from_buckets(
        self, buckets: list[dict], *, credit_as_override: str | None = None
    ) -> dict[str, Any]:
        """buckets: list of {monthly_total_inr, month_index} customer months only."""
        b = self.rules.bonus
        if not b.get("enabled"):
            return {"amount_inr": ZERO, "credit_as": "none"}

        customer_buckets = [x for x in buckets if x.get("is_customer_month", True)]
        totals = [Decimal(str(x.get("monthly_total_inr") or 0)) for x in customer_buckets]
        if not totals:
            return {"amount_inr": ZERO, "credit_as": b.get("credit_as")}

        formula = b.get("formula", "avg_monthly_buckets_all")
        if formula == "avg_monthly_buckets_last_n":
            n = int(b.get("avg_months") or 6)
            slice_totals = totals[-n:] if len(totals) >= n else totals
            amount = sum(slice_totals) / Decimal(len(slice_totals))
        elif formula == "equal_last_month_bucket":
            amount = totals[-1]
        elif formula == "fixed_inr":
            amount = Decimal(str(b.get("fixed_inr") or 0))
        else:
            amount = sum(totals) / Decimal(len(totals))

        amount = amount.quantize(Decimal("0.01"))
        credit_as = credit_as_override or b.get("credit_as") or "cash_pool"
        return {
            "amount_inr": amount,
            "credit_as": credit_as,
            "formula": formula,
            "bucket_count": len(customer_buckets),
        }

    def quote_redemption(
        self,
        *,
        inr_balance: Decimal,
        gold_grams: Decimal,
        mc_credit_inr: Decimal,
        metal_rate: Decimal,
        ornament_metal_inr: Decimal = ZERO,
        ornament_making_inr: Decimal = ZERO,
        offering_overrides: dict | None = None,
    ) -> dict[str, Any]:
        r = self.rules.redemption
        mode = r.get("mode", "jewellery_inr_pool")
        ov = offering_overrides or {}

        mc_policy = r.get("making_charge", "full")
        mc_pct = ov.get("redemption_making_charge_percent")
        if mc_pct is None and r.get("making_charge") == "reduced_percent":
            mc_pct = r.get("making_charge_percent")

        making_charge = ornament_making_inr
        mc_credit_applied = ZERO
        if mc_policy == "zero":
            making_charge = ZERO
        elif mc_policy == "mc_credit_first":
            mc_credit_applied = min(mc_credit_inr, making_charge)
            making_charge = making_charge - mc_credit_applied
        elif mc_policy == "reduced_percent" and mc_pct is not None:
            making_charge = (
                ornament_making_inr * Decimal(str(mc_pct)) / Decimal("100")
            ).quantize(Decimal("0.01"))

        if mode == "jewellery_inr_pool":
            bill_parts = ornament_redemption_bill_inr(ornament_metal_inr, making_charge)
            bill = bill_parts["total_inr"]
            from_pool = min(inr_balance, bill)
            topup = ZERO
            if r.get("allow_topup") and bill > from_pool:
                topup = bill - from_pool
            return {
                "mode": mode,
                "inr_balance": str(inr_balance),
                "bill_inr": str(bill),
                "gst_on_gold_inr": str(bill_parts["gst_on_gold_inr"]),
                "gst_on_making_inr": str(bill_parts["gst_on_making_inr"]),
                "from_pool_inr": str(from_pool),
                "topup_inr": str(topup),
                "making_charge_inr": str(making_charge),
                "mc_credit_applied_inr": str(mc_credit_applied),
                "can_redeem": inr_balance > 0 or topup == ZERO,
            }

        if mode in ("gold_grams", "gold_grams_from_inr_pool", "jewellery_from_gold"):
            grams_available = gold_grams
            if mode == "gold_grams_from_inr_pool" and metal_rate > 0:
                grams_available = (inr_balance / metal_rate).quantize(Decimal("0.000001"))
            return {
                "mode": mode,
                "gold_grams_available": str(grams_available),
                "inr_balance": str(inr_balance),
                "making_charge_inr": str(making_charge),
                "mc_credit_applied_inr": str(mc_credit_applied),
                "metal_rate_inr_per_gram": str(metal_rate),
            }

        return {"mode": mode, "detail": "Unsupported redemption mode."}

    def can_redeem_now(self, *, plan_month: int, bonus_confirmed: bool) -> bool:
        r = self.rules.redemption
        b = self.rules.bonus
        if r.get("lock_until_plan_complete"):
            if b.get("enabled") and not bonus_confirmed:
                return False
        redemption_from = b.get("redemption_from", "after_bonus")
        if redemption_from == "anytime":
            return True
        if redemption_from == "bonus_month":
            bonus_month = self.rules.cycle.get("jeweller_bonus_month") or 12
            return plan_month >= bonus_month
        return bonus_confirmed

    def ledger_kind_for_deposit(self) -> str:
        if self.rules.contribution.get("credit_mode") == "gold_grams":
            return "contribution_gold"
        return "contribution_inr"

    def bonus_ledger_kind(self, credit_as: str) -> str:
        if credit_as == "gold_grams":
            return "jeweller_bonus_gold"
        if credit_as == "making_charge_credit":
            return "making_charge_credit_inr"
        return "jeweller_bonus_inr"
