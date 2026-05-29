from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.services.jeweller_referral import (
    apply_customer_onboarding_jeweller,
    ensure_jeweller_referral_code,
    normalize_referral_code,
    referral_preview_payload,
)
from apps.accounts.vault_service import credit_customer_fractional, ensure_vault

User = get_user_model()


class JewellerReferralTests(TestCase):
    def setUp(self):
        self.j_onboard = User.objects.create_user(
            "onboard@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="onboard-shop",
            business_name="Onboard Jewellers",
            city="Kochi",
        )
        ensure_jeweller_referral_code(self.j_onboard)
        self.j_onboard.refresh_from_db()
        self.j_other = User.objects.create_user(
            "other@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="other-shop",
        )
        ensure_jeweller_referral_code(self.j_other)

    def test_normalize_referral_code_pads(self):
        code = self.j_onboard.jeweller_referral_code
        self.assertEqual(len(code), 6)
        short = code.lstrip("0") or "0"
        self.assertEqual(normalize_referral_code(short), code)

    def test_referral_preview(self):
        code = self.j_onboard.jeweller_referral_code
        payload = referral_preview_payload(code)
        self.assertIsNotNone(payload)
        assert payload is not None
        self.assertTrue(payload["valid"])
        self.assertEqual(payload["jeweller_id"], self.j_onboard.id)

    def test_apply_onboarding_sets_primary(self):
        c = User.objects.create_user(
            "cust@test.com",
            "pw",
            user_type=User.CUSTOMER,
        )
        warn = apply_customer_onboarding_jeweller(
            c,
            referral_code=self.j_onboard.jeweller_referral_code,
        )
        self.assertIsNone(warn)
        c.refresh_from_db()
        self.assertEqual(c.default_jeweller_id, self.j_onboard.id)
        self.assertEqual(c.onboarded_by_jeweller_id, self.j_onboard.id)

    def test_onboarding_primary_survives_first_purchase_elsewhere(self):
        c = User.objects.create_user(
            "cust2@test.com",
            "pw",
            user_type=User.CUSTOMER,
            default_jeweller=self.j_onboard,
            onboarded_by_jeweller=self.j_onboard,
        )
        credit_customer_fractional(c, self.j_other, Decimal("1.000000"))
        c.refresh_from_db()
        self.assertEqual(c.default_jeweller_id, self.j_onboard.id)

    def test_invalid_referral_returns_warning(self):
        c = User.objects.create_user(
            "cust3@test.com",
            "pw",
            user_type=User.CUSTOMER,
        )
        warn = apply_customer_onboarding_jeweller(c, referral_code="999999")
        self.assertIsNotNone(warn)
        c.refresh_from_db()
        self.assertIsNone(c.default_jeweller_id)

    def test_register_api_with_referral_code(self):
        client = APIClient()
        code = self.j_onboard.jeweller_referral_code
        res = client.post(
            "/api/v1/auth/register/",
            {
                "email": "api-ref@test.com",
                "password": "securepass1",
                "first_name": "Api",
                "last_name": "User",
                "referral_code": code,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data.get("onboarding_jeweller_applied"))
        user = User.objects.get(email="api-ref@test.com")
        self.assertEqual(user.default_jeweller_id, self.j_onboard.id)
