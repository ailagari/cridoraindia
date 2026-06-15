from decimal import Decimal

from django.test import TestCase

from apps.accounts.models import PlatformOperationalSettings
from apps.accounts.services.platform_operational import (
    gst_on_gold_percent,
    gst_on_making_percent,
    platform_billing_tax_payload,
    set_gst_on_gold_percent,
    set_gst_on_making_percent,
)
from apps.marketplace.gold_billing import gst_on_gold_inr, gst_on_making_inr


class PlatformBillingTaxTests(TestCase):
    def setUp(self):
        PlatformOperationalSettings.load()

    def test_default_rates(self):
        self.assertEqual(gst_on_gold_percent(), Decimal("3"))
        self.assertEqual(gst_on_making_percent(), Decimal("5"))

    def test_admin_can_update_rates(self):
        set_gst_on_gold_percent("5")
        set_gst_on_making_percent("12")
        payload = platform_billing_tax_payload()
        self.assertEqual(payload["gst_on_gold_percent"], "5")
        self.assertEqual(payload["gst_on_making_percent"], "12")
        self.assertEqual(gst_on_gold_inr(Decimal("1000")), Decimal("50.00"))
        self.assertEqual(gst_on_making_inr(Decimal("200")), Decimal("24.00"))

    def test_public_billing_tax_endpoint(self):
        set_gst_on_gold_percent("3.5")
        set_gst_on_making_percent("18")
        res = self.client.get("/api/v1/platform/billing-tax/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["gst_on_gold_percent"], "3.5")
        self.assertEqual(res.json()["gst_on_making_percent"], "18")
