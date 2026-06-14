from decimal import Decimal

from django.test import TestCase

from apps.schemes.services.presets import preset_design
from apps.schemes.services.scheme_design_compiler import (
    compile_scheme_design,
    preview_calculation,
    validate_scheme_design,
)
from apps.schemes.services.unified_scheme_engine import UnifiedSchemeEngine


class SchemeDesignCompilerTests(TestCase):
    def test_preset_eleven_plus_one_validates(self):
        design = preset_design("eleven_plus_one_jewellery_pool")
        self.assertIsNotNone(design)
        self.assertEqual(validate_scheme_design(design), [])

    def test_compile_produces_rules(self):
        design = preset_design("open_fractional_gold")
        rules = compile_scheme_design(design)
        self.assertEqual(rules["contribution"]["credit_mode"], "gold_grams")
        self.assertFalse(rules["cycle"]["enabled"])

    def test_preview_returns_breakdown(self):
        design = preset_design("eleven_plus_one_jewellery_pool")
        out = preview_calculation(design, sample_deposit_inr=5000)
        self.assertTrue(out.get("deposit_quote"))
        self.assertIn("deposit_quote", out)


class UnifiedSchemeEngineTests(TestCase):
    def test_quote_deposit_cash(self):
        design = preset_design("eleven_plus_one_jewellery_pool")
        rules = compile_scheme_design(design)
        engine = UnifiedSchemeEngine(rules)
        q = engine.quote_deposit(Decimal("5000"))
        self.assertEqual(q["total_inr"], "5000")

    def test_quote_deposit_gold_with_mc_and_gst_on_mc(self):
        design = preset_design("open_fractional_gold")
        design["input"]["making_charge_mode"] = "jeweller_percent"
        design["input"]["making_charge_percent"] = 10
        design["input"]["includes_gst_on_making_charge"] = True
        design["input"]["gst_on_making_charge_percent"] = 3
        rules = compile_scheme_design(design)
        engine = UnifiedSchemeEngine(rules)
        q = engine.quote_deposit(Decimal("5000"))
        self.assertEqual(q["payment_type"], "gold")
        self.assertGreater(Decimal(q["making_charge_inr"]), 0)
        self.assertGreater(Decimal(q["gst_on_making_charge_inr"]), 0)

    def test_bonus_avg_last_n(self):
        design = preset_design("eleven_plus_one_avg_six_gold")
        rules = compile_scheme_design(design)
        engine = UnifiedSchemeEngine(rules)
        buckets = [
            {"month_index": i, "monthly_total_inr": Decimal("1000"), "is_customer_month": True}
            for i in range(1, 12)
        ]
        result = engine.compute_bonus_from_buckets(buckets)
        self.assertEqual(result["amount_inr"], Decimal("1000.00"))
