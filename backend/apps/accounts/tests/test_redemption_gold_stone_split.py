from decimal import Decimal
from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase

from apps.marketplace.redemption_pricing import checkout_totals_with_vault

User = get_user_model()


class RedemptionGoldStoneSplitTests(SimpleTestCase):
    def test_vault_credit_and_gst_relief_apply_to_gold_only_not_stone(self):
        product = MagicMock()
        product.jeweller_id = 1
        product.is_x_redeem = False
        product.stone_included = True
        product.stone_cost_inr = Decimal("5000")
        product.gold_weight_grams = Decimal("10")
        product.making_charge_mode = "fixed_per_gram"
        product.making_charge_per_gram = Decimal("0")
        product.making_charge_percent = Decimal("0")
        product.same_store_making_charge_per_gram = None
        product.same_store_making_charge_percent = None
        product.manual_gold_rate_inr_per_gram = Decimal("8000")

        profile = MagicMock()
        profile.manual_gold_rate_inr_per_gram = Decimal("8000")
        profile.default_gold_markup_percent = Decimal("0")
        profile.buyback_headline_inr_per_gram = None

        customer = MagicMock()
        customer.user_type = User.CUSTOMER
        customer.default_jeweller_id = None

        from apps.marketplace import redemption_pricing as rp

        rp.jeweller_profile_for = lambda _j: profile
        rp.resolve_listing_metal_rate_inr = lambda _p, _pr=None: Decimal("8000")
        rp.gold_metal_value_inr = lambda _p, _r: Decimal("80000")
        rp.stone_component_inr = lambda _p: Decimal("5000")
        rp.customer_has_vault_holdings_at_jeweller = lambda _c, _j: True

        cash = checkout_totals_with_vault(product, customer, Decimal("0"))
        full = checkout_totals_with_vault(product, customer, Decimal("10"))

        self.assertEqual(cash["gold_metal_value_inr"], Decimal("80000"))
        self.assertEqual(cash["stone_component_inr"], Decimal("5000"))
        self.assertEqual(cash["gst_on_gold_full_inr"], Decimal("2400"))
        self.assertEqual(full["vault_metal_credit_inr"], Decimal("80000"))
        self.assertEqual(full["gst_on_gold_charged_inr"], Decimal("0"))
        self.assertEqual(full["gst_on_gold_saved_inr"], Decimal("2400"))
