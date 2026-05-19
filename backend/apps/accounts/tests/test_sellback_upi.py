"""UPI sellback payout tests (Model A reversed — jeweller pays customer)."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.accounts.models import GoldSellbackRequest
from apps.accounts.services.sellback_upi import build_sellback_payout_uri, payout_note_for
from apps.accounts.vault_service import customer_fractional_available, ensure_vault, credit_customer_fractional
from apps.marketplace.models import JewellerPricingProfile, jeweller_profile_for

User = get_user_model()


class SellbackUpiServiceTests(APITestCase):
    def test_build_payout_uri_includes_amount_and_ref(self):
        uri = build_sellback_payout_uri(
            vpa="buyer@okhdfcbank",
            payee_name="Test Buyer",
            amount_inr=Decimal("3500.00"),
            sellback_id=7,
        )
        self.assertTrue(uri.startswith("upi://pay?"))
        self.assertIn("pa=buyer%40okhdfcbank", uri)
        self.assertIn("am=3500.00", uri)
        self.assertIn("tr=SB-7", uri)

    def test_payout_note_for(self):
        self.assertEqual(payout_note_for(12), "Cridora SB-12")


class SellbackUpiApiTests(APITestCase):
    def setUp(self):
        self.jeweller = User.objects.create_user(
            "jeweller_sb_upi@test.com",
            "pass",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Sellback Jewellers",
            jeweller_code="sbshop",
            gold_handle_local="sbshopvault",
        )
        profile = jeweller_profile_for(self.jeweller)
        profile.gold_rate_source = JewellerPricingProfile.GOLD_RATE_MANUAL
        profile.manual_gold_rate_inr_per_gram = Decimal("7000.00")
        profile.sellback_fixed_inr_per_gram = Decimal("6500.00")
        profile.save()

        self.customer = User.objects.create_user(
            "customer_sb_upi@test.com",
            "pass",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            gold_handle_local="seller1",
            default_jeweller=self.jeweller,
            payout_upi_vpa="seller@okhdfcbank",
        )
        ensure_vault(self.customer, self.jeweller)
        credit_customer_fractional(self.customer, self.jeweller, Decimal("2.000000"))

    def _create_upi_sellback(self) -> int:
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            "/api/v1/gold/sellback/confirm/",
            {
                "jeweller_id": self.jeweller.id,
                "grams": "0.500000",
                "payment_method": "upi",
                "payout_upi_vpa": "seller@okhdfcbank",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["sellback"]["payment_method"], "upi")
        self.assertNotIn("otp_code", res.data)
        return res.data["sellback"]["id"]

    def test_upi_sellback_requires_payout_vpa(self):
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            "/api/v1/gold/sellback/confirm/",
            {
                "jeweller_id": self.jeweller.id,
                "grams": "0.500000",
                "payment_method": "upi",
                "payout_upi_vpa": "not-a-vpa",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_jeweller_payout_and_submit_utr_customer_confirms(self):
        sellback_id = self._create_upi_sellback()
        before = customer_fractional_available(self.customer, self.jeweller)

        self.client.force_authenticate(self.jeweller)
        accept = self.client.post(f"/api/v1/jeweller/sellbacks/{sellback_id}/accept/", {}, format="json")
        self.assertEqual(accept.status_code, 200, accept.data)

        payout = self.client.get(f"/api/v1/jeweller/sellbacks/{sellback_id}/payout/")
        self.assertEqual(payout.status_code, 200, payout.data)
        self.assertIn("upi_uri", payout.data["payout"])
        self.assertEqual(payout.data["payout"]["payee_vpa"], "seller@okhdfcbank")

        submit = self.client.post(
            f"/api/v1/jeweller/sellbacks/{sellback_id}/submit-utr/",
            {"utr": "987654321098"},
            format="json",
        )
        self.assertEqual(submit.status_code, 200, submit.data)
        self.assertEqual(submit.data["status"], "awaiting_utr_verify")

        self.client.force_authenticate(self.customer)
        confirm = self.client.post(f"/api/v1/gold/sellback/{sellback_id}/confirm-utr/", {}, format="json")
        self.assertEqual(confirm.status_code, 200, confirm.data)
        self.assertEqual(confirm.data["sellback"]["status"], "completed")

        after = customer_fractional_available(self.customer, self.jeweller)
        self.assertEqual(before - after, Decimal("0.500000"))

        row = GoldSellbackRequest.objects.get(pk=sellback_id)
        self.assertEqual(row.status, GoldSellbackRequest.STATUS_COMPLETED)
        self.assertEqual(row.upi_utr, "987654321098")

    def test_customer_can_cancel_pending_upi_sellback(self):
        sellback_id = self._create_upi_sellback()
        self.client.force_authenticate(self.customer)
        res = self.client.post(f"/api/v1/gold/sellback/{sellback_id}/cancel-upi/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "cancelled")

    def test_cash_sellback_still_issues_otp(self):
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            "/api/v1/gold/sellback/confirm/",
            {
                "jeweller_id": self.jeweller.id,
                "grams": "0.500000",
                "payment_method": "cash",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIn("otp_code", res.data)
        self.assertEqual(res.data["sellback"]["payment_method"], "cash")
