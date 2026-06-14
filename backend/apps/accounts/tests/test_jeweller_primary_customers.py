from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.services.jeweller_referral import apply_customer_onboarding_jeweller, ensure_jeweller_referral_code
from apps.accounts.vault_service import credit_customer_fractional

User = get_user_model()


class JewellerPrimaryCustomersViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.jeweller = User.objects.create_user(
            "jeweller-primary-base@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="primary-base",
            business_name="Primary Base Jewellers",
        )
        ensure_jeweller_referral_code(self.jeweller)
        self.other_jeweller = User.objects.create_user(
            "other-jeweller@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="other-shop",
            business_name="Other Jewellers",
        )
        ensure_jeweller_referral_code(self.other_jeweller)
        self.primary_customer = User.objects.create_user(
            "primary-cust@test.com",
            "pw",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            first_name="Priya",
            last_name="Customer",
        )
        self.secondary_customer = User.objects.create_user(
            "secondary-cust@test.com",
            "pw",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            first_name="Ravi",
            last_name="Vault",
        )

    def test_jeweller_sees_primary_customer_count(self):
        apply_customer_onboarding_jeweller(
            self.primary_customer,
            referral_code=self.jeweller.jeweller_referral_code,
        )
        credit_customer_fractional(self.primary_customer, self.jeweller, Decimal("1.250000"))

        self.secondary_customer.default_jeweller = self.other_jeweller
        self.secondary_customer.save(update_fields=["default_jeweller"])
        credit_customer_fractional(self.secondary_customer, self.jeweller, Decimal("0.500000"))

        self.client.force_authenticate(self.jeweller)
        res = self.client.get("/api/v1/jeweller/primary-customers/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["primary_customer_count"], 1)
        self.assertEqual(len(res.data["results"]), 1)
        row = res.data["results"][0]
        self.assertEqual(row["customer_id"], self.primary_customer.id)
        self.assertEqual(row["customer_label"], "Priya Customer")
        self.assertEqual(Decimal(row["vault_total_grams"]), Decimal("1.250000"))

    def test_customer_cannot_access_jeweller_primary_customers(self):
        self.client.force_authenticate(self.primary_customer)
        res = self.client.get("/api/v1/jeweller/primary-customers/")
        self.assertEqual(res.status_code, 403)
