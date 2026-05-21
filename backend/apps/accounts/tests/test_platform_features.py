from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import PlatformOperationalSettings
from apps.accounts.platform_features import effective_feature_flags, is_feature_enabled, set_feature_flags

User = get_user_model()


class PlatformFeatureRolloutTests(TestCase):
    def setUp(self):
        PlatformOperationalSettings.load()
        self.admin = User.objects.create_user(
            "admin@rollout.test",
            "pass",
            user_type=User.ADMIN,
            kyc_status=User.KYC_VERIFIED,
        )
        self.customer = User.objects.create_user(
            "cust@rollout.test",
            "pass",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )
        self.client = APIClient()

    def test_sellback_upi_off_by_default(self):
        self.assertFalse(is_feature_enabled("sellback_upi"))
        self.assertTrue(is_feature_enabled("sellback_cash"))

    def test_admin_can_toggle_flags(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            "/api/v1/admin/feature-rollout/",
            {"flags": {"sellback_upi": True}},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["flags"]["sellback_upi"])

    def test_customer_reads_platform_features(self):
        set_feature_flags({"golden_scheme": True})
        self.client.force_authenticate(self.customer)
        res = self.client.get("/api/v1/platform/features/")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["flags"]["golden_scheme"])
        self.assertTrue(body["customer_sections"]["invest_scheme"])

    def test_effective_flags_merge_defaults(self):
        flags = effective_feature_flags()
        self.assertIn("fractional_purchase", flags)
        self.assertTrue(flags["sellback_cash"])
