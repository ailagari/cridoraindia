"""Model A fractional UPI: jeweller VPA, customer UTR paste, jeweller confirm."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import FractionalGoldPurchase
from apps.accounts.services.fractional_upi import (
    build_upi_pay_uri,
    normalize_utr,
    payment_note_for,
)
from apps.accounts.vault_service import customer_fractional_available, ensure_vault
from apps.marketplace.models import JewellerPricingProfile, jeweller_profile_for

User = get_user_model()


class FractionalUpiServiceTests(APITestCase):
    def test_normalize_utr_strips_spaces(self):
        self.assertEqual(normalize_utr(" 1234 5678 9012 "), "123456789012")

    def test_build_upi_pay_uri_includes_amount_and_ref(self):
        uri = build_upi_pay_uri(
            vpa="shop@okicici",
            payee_name="Gold House",
            amount_inr=Decimal("515.00"),
            purchase_id=42,
        )
        self.assertTrue(uri.startswith("upi://pay?"))
        self.assertIn("pa=shop%40okicici", uri)
        self.assertIn("am=515.00", uri)
        self.assertIn("tr=FR-42", uri)


class FractionalUpiApiTests(APITestCase):
    def setUp(self):
        self.jeweller = User.objects.create_user(
            "jeweller_upi@test.com",
            "pass",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="UPI Jewellers",
            jeweller_code="upishop",
            gold_handle_local="upishopvault",
        )
        profile = jeweller_profile_for(self.jeweller)
        profile.gold_rate_source = JewellerPricingProfile.GOLD_RATE_MANUAL
        profile.manual_gold_rate_inr_per_gram = Decimal("7000.00")
        profile.upi_vpa = "upijeweller@okicici"
        profile.save()

        self.customer = User.objects.create_user(
            "customer_upi@test.com",
            "pass",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            gold_handle_local="buyer1",
            default_jeweller=self.jeweller,
        )
        ensure_vault(self.customer, self.jeweller)

        self.other_jeweller = User.objects.create_user(
            "other_j@test.com",
            "pass",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="otherj",
            gold_handle_local="otherjv",
        )

    def _create_upi_order(self) -> int:
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            "/api/v1/fractional/orders/",
            {
                "jeweller_id": self.jeweller.id,
                "payment_method": "upi",
                "mode": "by_total_inr",
                "total_inr": "5000",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["payment_method"], "upi")
        self.assertEqual(res.data["status"], "pending_payment")
        self.assertEqual(res.data["payee_upi_vpa"], "upijeweller@okicici")
        self.assertEqual(res.data["payment_note"], payment_note_for(res.data["id"]))
        return res.data["id"]

    def test_upi_order_requires_jeweller_vpa(self):
        bare = User.objects.create_user(
            "bare_j@test.com",
            "pass",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="barej",
            gold_handle_local="barejv",
        )
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            "/api/v1/fractional/orders/",
            {
                "jeweller_id": bare.id,
                "payment_method": "upi",
                "mode": "by_total_inr",
                "total_inr": "5000",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_payment_payload_and_submit_utr(self):
        order_id = self._create_upi_order()
        pay = self.client.get(f"/api/v1/fractional/orders/{order_id}/payment/")
        self.assertEqual(pay.status_code, 200)
        self.assertIn("upi_uri", pay.data["payment"])
        self.assertEqual(pay.data["payment"]["payee_vpa"], "upijeweller@okicici")

        submit = self.client.post(
            f"/api/v1/fractional/orders/{order_id}/submit-utr/",
            {"utr": "123456789012"},
            format="json",
        )
        self.assertEqual(submit.status_code, 200)
        self.assertEqual(submit.data["status"], "awaiting_utr_verify")
        self.assertEqual(submit.data["upi_utr"], "123456789012")

    def test_duplicate_utr_rejected(self):
        first_id = self._create_upi_order()
        self.client.post(
            f"/api/v1/fractional/orders/{first_id}/submit-utr/",
            {"utr": "998877665544"},
            format="json",
        )
        second_id = self._create_upi_order()
        dup = self.client.post(
            f"/api/v1/fractional/orders/{second_id}/submit-utr/",
            {"utr": "998877665544"},
            format="json",
        )
        self.assertEqual(dup.status_code, 400)

    def test_jeweller_confirms_utr_and_credits_gold(self):
        order_id = self._create_upi_order()
        self.client.post(
            f"/api/v1/fractional/orders/{order_id}/submit-utr/",
            {"utr": "112233445566"},
            format="json",
        )
        before = customer_fractional_available(self.customer, self.jeweller)
        self.client.force_authenticate(self.jeweller)
        confirm = self.client.post(
            f"/api/v1/jeweller/fractional/orders/{order_id}/confirm-utr/",
            {},
            format="json",
        )
        self.assertEqual(confirm.status_code, 200, confirm.data)
        self.assertEqual(confirm.data["status"], "completed")
        after = customer_fractional_available(self.customer, self.jeweller)
        self.assertGreater(after, before)

    def test_wrong_jeweller_cannot_confirm(self):
        order_id = self._create_upi_order()
        self.client.post(
            f"/api/v1/fractional/orders/{order_id}/submit-utr/",
            {"utr": "554433221100"},
            format="json",
        )
        self.client.force_authenticate(self.other_jeweller)
        res = self.client.post(
            f"/api/v1/jeweller/fractional/orders/{order_id}/confirm-utr/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, 404)

    def test_expired_order_rejects_utr(self):
        order_id = self._create_upi_order()
        FractionalGoldPurchase.objects.filter(pk=order_id).update(
            payment_expires_at=timezone.now() - timezone.timedelta(minutes=5)
        )
        res = self.client.post(
            f"/api/v1/fractional/orders/{order_id}/submit-utr/",
            {"utr": "667788990011"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_jeweller_pending_upi_lists_submitted_orders(self):
        order_id = self._create_upi_order()
        self.client.post(
            f"/api/v1/fractional/orders/{order_id}/submit-utr/",
            {"utr": "123443211234"},
            format="json",
        )
        self.client.force_authenticate(self.jeweller)
        pending = self.client.get("/api/v1/jeweller/fractional/pending-upi/")
        self.assertEqual(pending.status_code, 200)
        ids = [row["id"] for row in pending.data["results"]]
        self.assertIn(order_id, ids)

    def test_jeweller_profile_upi_patch(self):
        self.client.force_authenticate(self.jeweller)
        res = self.client.patch(
            "/api/v1/jeweller/profile/upi/",
            {"upi_vpa": "newshop@paytm", "upi_display_name": "New Shop"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["upi_vpa"], "newshop@paytm")
        self.assertTrue(res.data["configured"])

    def test_counter_order_unchanged(self):
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            "/api/v1/fractional/orders/",
            {
                "jeweller_id": self.jeweller.id,
                "payment_method": "counter",
                "mode": "by_total_inr",
                "total_inr": "5000",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "awaiting_counter")
        self.assertEqual(res.data["payment_method"], "counter")
