from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.models import VaultHolding
from apps.accounts.vault_service import ensure_vault
from apps.marketplace.redemption_cross_bridge import (
    build_cross_redemption_quote_addon,
    pick_cross_source_jeweller,
)
from apps.marketplace.redemption_pricing import order_vault_grams_target

User = get_user_model()


class RedemptionCrossBridgeTests(TestCase):
    def setUp(self):
        self.src = User.objects.create_user(
            "src@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Source Shop",
        )
        self.dst = User.objects.create_user(
            "dst@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Dest Shop",
        )
        self.customer = User.objects.create_user(
            "cust@test.com",
            "pw",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            default_jeweller=self.src,
        )
        src_vault = ensure_vault(self.customer, self.src)
        ensure_vault(self.customer, self.dst)
        VaultHolding.objects.filter(vault=src_vault, holding_type=VaultHolding.FRACTIONAL).update(
            balance_grams=Decimal("10.000000"),
        )

    def test_pick_source_prefers_default_jeweller(self):
        picked = pick_cross_source_jeweller(self.customer, self.dst.id, Decimal("3"))
        self.assertIsNotNone(picked)
        assert picked is not None
        self.assertEqual(picked[0], self.src.id)

    def test_quote_addon_when_listing_vault_empty(self):
        addon = build_cross_redemption_quote_addon(
            self.customer,
            listing_jeweller=self.dst,
            grams_target=Decimal("2.500000"),
            grams_available_at_listing=Decimal("0"),
            metal_rate_inr=Decimal("8000"),
        )
        self.assertIsNotNone(addon)
        assert addon is not None
        self.assertEqual(addon["source_jeweller_id"], self.src.id)
        self.assertEqual(addon["grams_to_move"], "2.500000")

    def test_order_vault_grams_target_exists(self):
        self.assertTrue(callable(order_vault_grams_target))
