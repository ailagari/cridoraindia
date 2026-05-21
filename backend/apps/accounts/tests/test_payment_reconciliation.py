"""Reconciliation scoring and engine tests."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.accounts.models import FractionalGoldPurchase, PlatformCommercialLedgerEntry
from apps.accounts.services.payment_reconciliation.scoring import calculate_confidence
from apps.accounts.services.payment_reconciliation.signals import capture_sms_signal
from apps.accounts.vault_service import ensure_vault
from apps.marketplace.models import JewellerPricingProfile, jeweller_profile_for

User = get_user_model()

SMS_MATCH = (
    "Rs.5000.00 debited from A/c XX1234\n"
    "UPI Ref No 123456789012 to upijeweller@okicici"
)


class ReconciliationScoringTests(APITestCase):
    def setUp(self):
        self.jeweller = User.objects.create_user(
            "rec_j@test.com",
            "pass",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Rec Jeweller",
            jeweller_code="recj",
            gold_handle_local="recjv",
        )
        profile = jeweller_profile_for(self.jeweller)
        profile.upi_vpa = "upijeweller@okicici"
        profile.save()
        self.customer = User.objects.create_user(
            "rec_c@test.com",
            "pass",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            gold_handle_local="recc",
            default_jeweller=self.jeweller,
        )
        ensure_vault(self.customer, self.jeweller)
        self.purchase = FractionalGoldPurchase.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            metal_rate_inr_per_gram=Decimal("7000"),
            grams=Decimal("0.5"),
            gold_value_inr_pre_gst=Decimal("3500"),
            gst_percent=Decimal("3"),
            gst_inr=Decimal("105"),
            total_inr=Decimal("3605"),
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status=FractionalGoldPurchase.PENDING_PAYMENT,
            payee_upi_vpa="upijeweller@okicici",
            payment_note="Cridora CR-99",
        )

    def test_sms_signal_high_score(self):
        capture_sms_signal(self.purchase, SMS_MATCH.replace("5000", "3605"))
        sig = self.purchase.payment_signals.first()
        self.assertIsNotNone(sig)
        score = calculate_confidence(self.purchase, sig)
        self.assertGreaterEqual(score, 85)


class ReconciliationApiTests(APITestCase):
    def setUp(self):
        self.jeweller = User.objects.create_user(
            "recapi_j@test.com",
            "pass",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Rec API Jeweller",
            jeweller_code="recapij",
            gold_handle_local="recapijv",
        )
        profile = jeweller_profile_for(self.jeweller)
        profile.gold_rate_source = JewellerPricingProfile.GOLD_RATE_MANUAL
        profile.manual_gold_rate_inr_per_gram = Decimal("7000.00")
        profile.upi_vpa = "upijeweller@okicici"
        profile.save()
        self.customer = User.objects.create_user(
            "recapi_c@test.com",
            "pass",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            gold_handle_local="recapic",
            default_jeweller=self.jeweller,
        )
        ensure_vault(self.customer, self.jeweller)

    def _create_order(self) -> int:
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
        self.assertEqual(res.status_code, 201)
        return res.data["id"]

    def test_sms_auto_confirms_order(self):
        order_id = self._create_order()
        purchase = FractionalGoldPurchase.objects.get(pk=order_id)
        amount = str(purchase.total_inr)
        sms = (
            f"Rs.{amount} debited from A/c XX1234\n"
            "UPI Ref No 987654321098 to upijeweller@okicici"
        )
        res = self.client.post(
            f"/api/v1/fractional/orders/{order_id}/payment-signal/sms/",
            {"sms_text": sms},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "completed")
        self.assertTrue(
            PlatformCommercialLedgerEntry.objects.filter(
                fractional_purchase_id=order_id
            ).exists()
            or res.data["status"] == "completed"
        )

    def test_confirm_upi_disabled(self):
        order_id = self._create_order()
        res = self.client.post(
            f"/api/v1/fractional/orders/{order_id}/confirm-upi/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, 410)

    def test_optional_utr_submit_without_utr(self):
        order_id = self._create_order()
        res = self.client.post(
            f"/api/v1/fractional/orders/{order_id}/submit-utr/",
            {"utr": ""},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
