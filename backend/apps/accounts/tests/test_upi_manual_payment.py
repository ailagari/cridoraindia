"""Tests for unified manual UPI proof workflow."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import FractionalGoldPurchase, User
from apps.marketplace.models import JewellerPricingProfile


class UpiManualPaymentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username="upi_c@test.com",
            email="upi_c@test.com",
            password="pass12345",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )
        self.jeweller = User.objects.create_user(
            username="upi_j@test.com",
            email="upi_j@test.com",
            password="pass12345",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Test Jeweller",
        )
        JewellerPricingProfile.objects.create(
            jeweller=self.jeweller,
            upi_vpa="shop@testupi",
            upi_display_name="Test Jeweller",
        )
        self.purchase = FractionalGoldPurchase.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            metal_rate_inr_per_gram=Decimal("6000"),
            grams=Decimal("0.100000"),
            gold_value_inr_pre_gst=Decimal("600.00"),
            gst_percent=Decimal("3"),
            gst_inr=Decimal("18.00"),
            total_inr=Decimal("618.00"),
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status=FractionalGoldPurchase.PENDING_PAYMENT,
            payee_upi_vpa="shop@testupi",
            payment_note="Cridora CR-1",
        )

    def test_submit_utr_goes_pending_review(self):
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            f"/api/v1/upi/fractional/{self.purchase.pk}/submit-utr/",
            {"utr": "ABC123456789"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.status, FractionalGoldPurchase.PENDING_REVIEW)
        self.assertEqual(self.purchase.upi_utr, "ABC123456789")

    def test_jeweller_approve_completes(self):
        self.purchase.status = FractionalGoldPurchase.PENDING_REVIEW
        self.purchase.upi_utr = "ABC123456789"
        self.purchase.save()
        self.client.force_authenticate(user=self.jeweller)
        res = self.client.post(f"/api/v1/upi/fractional/{self.purchase.pk}/approve/")
        self.assertEqual(res.status_code, 200, res.data)
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.status, FractionalGoldPurchase.COMPLETED)

    def test_reject_twice_on_hold(self):
        self.purchase.status = FractionalGoldPurchase.PENDING_REVIEW
        self.purchase.upi_utr = "ABC123456789"
        self.purchase.save()
        self.client.force_authenticate(user=self.jeweller)
        for remark in ("Wrong amount", "Still invalid"):
            res = self.client.post(
                f"/api/v1/upi/fractional/{self.purchase.pk}/reject/",
                {"remark": remark, "confirm": True},
                format="json",
            )
            self.assertEqual(res.status_code, 200, res.data)
            self.purchase.refresh_from_db()
            if remark == "Wrong amount":
                self.assertEqual(self.purchase.status, FractionalGoldPurchase.PROOF_REJECTED)
                self.purchase.status = FractionalGoldPurchase.PENDING_REVIEW
                self.purchase.save()
        self.assertEqual(self.purchase.status, FractionalGoldPurchase.ON_HOLD)

    def test_resubmit_after_reject_goes_pending_review(self):
        self.purchase.status = FractionalGoldPurchase.PROOF_REJECTED
        self.purchase.upi_utr = "OLDUTR123456"
        self.purchase.upi_rejection_count = 1
        self.purchase.upi_last_rejection_remark = "Screenshot unclear"
        self.purchase.save()
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            f"/api/v1/upi/fractional/{self.purchase.pk}/submit-utr/",
            {"utr": "NEWUTR123456789"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.status, FractionalGoldPurchase.PENDING_REVIEW)
        self.assertEqual(self.purchase.upi_utr, "NEWUTR123456789")
