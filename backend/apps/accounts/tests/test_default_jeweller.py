from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.services.jeweller_referral import apply_customer_onboarding_jeweller, ensure_jeweller_referral_code
from apps.accounts.vault_service import credit_customer_fractional, ensure_vault

User = get_user_model()


class DefaultJewellerViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.j_primary = User.objects.create_user(
            "primary@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="primary-shop",
            business_name="Primary Jewellers",
        )
        ensure_jeweller_referral_code(self.j_primary)
        self.j_secondary = User.objects.create_user(
            "secondary@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="secondary-shop",
            business_name="Secondary Jewellers",
        )
        ensure_jeweller_referral_code(self.j_secondary)
        self.customer = User.objects.create_user(
            "cust-default@test.com",
            "pw",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )

    def test_set_primary_without_vault_from_search(self):
        self.client.force_authenticate(self.customer)
        res = self.client.patch(
            "/api/v1/gold/default-jeweller/",
            {"jeweller_id": self.j_primary.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.default_jeweller_id, self.j_primary.id)

    def test_promote_secondary_with_vault(self):
        apply_customer_onboarding_jeweller(
            self.customer,
            referral_code=self.j_primary.jeweller_referral_code,
        )
        credit_customer_fractional(self.customer, self.j_primary, Decimal("0.500000"))
        credit_customer_fractional(self.customer, self.j_secondary, Decimal("1.000000"))
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.default_jeweller_id, self.j_primary.id)

        self.client.force_authenticate(self.customer)
        res = self.client.patch(
            "/api/v1/gold/default-jeweller/",
            {"jeweller_id": self.j_secondary.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.default_jeweller_id, self.j_secondary.id)
        self.assertIn("secondary_jeweller_ids", res.data)
        self.assertIn(self.j_primary.id, res.data["secondary_jeweller_ids"])

    def test_cannot_promote_jeweller_without_vault_when_holdings_exist(self):
        apply_customer_onboarding_jeweller(
            self.customer,
            referral_code=self.j_primary.jeweller_referral_code,
        )
        ensure_vault(self.customer, self.j_primary)
        self.client.force_authenticate(self.customer)
        res = self.client.patch(
            "/api/v1/gold/default-jeweller/",
            {"jeweller_id": self.j_secondary.id},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.default_jeweller_id, self.j_primary.id)
