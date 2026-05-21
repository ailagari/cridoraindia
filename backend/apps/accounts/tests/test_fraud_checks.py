from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.models import FractionalGoldPurchase
from apps.accounts.services.payment_reconciliation.fraud import (
    FLAG_DUPLICATE,
    blocks_auto_confirm,
    check_fraud_flags,
)
from apps.accounts.services.payment_reconciliation.signals import capture_user_input_signal

User = get_user_model()


class FraudCheckTests(TestCase):
    def setUp(self):
        self.jeweller = User.objects.create_user(
            "fraud_j@test.com",
            "pass",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
        )
        self.customer = User.objects.create_user(
            "fraud_c@test.com",
            "pass",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )
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
            payee_upi_vpa="shop@upi",
            upi_utr="111122223333",
        )
        other = FractionalGoldPurchase.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            metal_rate_inr_per_gram=Decimal("7000"),
            grams=Decimal("0.5"),
            gold_value_inr_pre_gst=Decimal("3500"),
            gst_percent=Decimal("3"),
            gst_inr=Decimal("105"),
            total_inr=Decimal("3605"),
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status=FractionalGoldPurchase.COMPLETED,
            payee_upi_vpa="shop@upi",
            upi_utr="999988887777",
        )
        self.other = other

    def test_duplicate_utr_flagged(self):
        flags = check_fraud_flags(
            self.purchase,
            utr="999988887777",
            proposed_score=90,
        )
        self.assertTrue(flags.get(FLAG_DUPLICATE))
        self.assertTrue(blocks_auto_confirm(flags))
