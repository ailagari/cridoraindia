from decimal import Decimal

from django.test import TestCase

from apps.accounts.models import PlatformOperationalSettings
from apps.accounts.services.personal_vault_billing import (
    derive_metal_rate_from_bill,
    personal_vault_bill_breakdown,
    resolve_purchase_price_inr_per_gram,
)
from apps.accounts.services.platform_operational import (
    set_gst_on_gold_percent,
    set_gst_on_making_percent,
)


class PersonalVaultBillingTests(TestCase):
    def setUp(self):
        PlatformOperationalSettings.load()
        set_gst_on_gold_percent(Decimal("3"))
        set_gst_on_making_percent(Decimal("5"))

    def test_derive_rate_from_bill_with_making(self):
        weight = Decimal("1.1890")
        total = Decimal("18000")
        mc = Decimal("5.7")
        rate = derive_metal_rate_from_bill(weight, total, making_charge_percent=mc)
        self.assertIsNotNone(rate)
        self.assertEqual(rate, Decimal("13890.6897"))

    def test_bill_breakdown_from_total(self):
        bd = personal_vault_bill_breakdown(
            Decimal("1"),
            purchase_total_inr=Decimal("10300"),
            making_charge_percent=Decimal("0"),
        )
        self.assertIsNotNone(bd)
        self.assertEqual(bd["purchase_total_inr"], "10300.00")
        self.assertEqual(bd["metal_rate_inr_per_gram"], "10000.0000")

    def test_resolve_prefers_bill_total(self):
        rate = resolve_purchase_price_inr_per_gram(
            weight_grams=Decimal("1"),
            purchase_price_inr_per_gram=Decimal("9999"),
            purchase_total_inr=Decimal("10300"),
            making_charge_percent=Decimal("0"),
        )
        self.assertEqual(rate, Decimal("10000.0000"))
