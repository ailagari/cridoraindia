"""Fractional purchase pricing with platform markup."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.accounts.fractional_service import (
    apply_fractional_platform_markup,
    fractional_metal_rate_inr_per_gram,
    jeweller_metal_rate_inr_per_gram,
)
from apps.accounts.models import PlatformOperationalSettings
from apps.accounts.services.platform_operational import set_fractional_markup_percent
from apps.marketplace.models import JewellerPricingProfile, jeweller_profile_for

User = get_user_model()


class FractionalMarkupServiceTests(TestCase):
    def test_apply_fractional_platform_markup_zero(self):
        self.assertEqual(
            apply_fractional_platform_markup(Decimal("7000.00")),
            Decimal("7000.00"),
        )

    def test_apply_fractional_platform_markup_percent(self):
        PlatformOperationalSettings.load()
        set_fractional_markup_percent("2.5")
        self.assertEqual(
            apply_fractional_platform_markup(Decimal("7000.00")),
            Decimal("7175.00"),
        )


class FractionalMarkupApiTests(APITestCase):
    def setUp(self):
        PlatformOperationalSettings.load()
        set_fractional_markup_percent("5")

        self.jeweller = User.objects.create_user(
            "markup_j@test.com",
            "pass",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Markup Jewellers",
            jeweller_code="markupj",
            gold_handle_local="markupjv",
        )
        profile = jeweller_profile_for(self.jeweller)
        profile.gold_rate_source = JewellerPricingProfile.GOLD_RATE_MANUAL
        profile.manual_gold_rate_inr_per_gram = Decimal("7000.00")
        profile.save()

        self.customer = User.objects.create_user(
            "markup_c@test.com",
            "pass",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            gold_handle_local="markupbuyer",
            default_jeweller=self.jeweller,
        )

    def test_fractional_rate_includes_platform_markup(self):
        base = jeweller_metal_rate_inr_per_gram(self.jeweller)
        rate = fractional_metal_rate_inr_per_gram(self.jeweller)
        expected = (base * Decimal("1.05")).quantize(Decimal("0.01"))
        self.assertEqual(rate, expected)

    def test_quote_uses_marked_up_rate(self):
        self.client.force_authenticate(self.customer)
        base = jeweller_metal_rate_inr_per_gram(self.jeweller)
        marked = (base * Decimal("1.05")).quantize(Decimal("0.01"))
        res = self.client.post(
            "/api/v1/fractional/quote/",
            {
                "jeweller_id": self.jeweller.id,
                "mode": "by_grams",
                "grams": "1",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["base_metal_rate_inr_per_gram"], str(base))
        self.assertEqual(res.data["fractional_markup_percent"], "5.000")
        self.assertEqual(res.data["metal_rate_inr_per_gram"], str(marked))
        self.assertEqual(res.data["gold_value_inr_pre_gst"], str(marked))
        gst = (marked * Decimal("0.03")).quantize(Decimal("0.01"))
        self.assertEqual(res.data["total_inr"], str((marked + gst).quantize(Decimal("0.01"))))

    def test_admin_can_read_and_set_markup(self):
        admin = User.objects.create_user(
            "admin_markup@test.com",
            "pass",
            user_type=User.ADMIN,
            kyc_status=User.KYC_VERIFIED,
        )
        self.client.force_authenticate(admin)
        res = self.client.get("/api/v1/admin/fractional-counter-otp-policy/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["fractional_markup_percent"], "5.000")

        patch = self.client.patch(
            "/api/v1/admin/fractional-counter-otp-policy/",
            {"fractional_markup_percent": "1.5"},
            format="json",
        )
        self.assertEqual(patch.status_code, 200, patch.data)
        self.assertEqual(patch.data["fractional_markup_percent"], "1.500")
