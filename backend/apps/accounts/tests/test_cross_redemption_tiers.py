from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.models import CrossRedemptionRequest, GoldVault, JewellerCrossPolicy, VaultHolding
from apps.accounts.services.cross_redemption.authorization import _policy, authorize_cross_redemption
from apps.accounts.services.cross_redemption.limits import classify_auth_tier
from apps.accounts.services.cross_redemption.reference import cross_redemption_public_reference
from apps.accounts.vault_service import ensure_vault

User = get_user_model()


class CrossRedemptionTierTests(TestCase):
    def setUp(self):
        self.src = User.objects.create_user(
            "src-j@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Source Shop",
        )
        self.dst = User.objects.create_user(
            "dst-j@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Dest Shop",
        )
        self.customer = User.objects.create_user(
            "cust@test.com",
            "pw",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            default_jeweller=self.src,
        )
        vault = ensure_vault(self.customer, self.src)
        VaultHolding.objects.filter(vault=vault, holding_type=VaultHolding.FRACTIONAL).update(
            balance_grams=Decimal("20.000000"),
        )

    def test_public_reference_format(self):
        ref = cross_redemption_public_reference(42)
        self.assertTrue(ref.startswith("CRX-"))
        self.assertIn("-000042", ref)

    def test_large_txn_is_manual_not_reject(self):
        policy = _policy(self.src)
        tier, reasons = classify_auth_tier(
            policy,
            grams=Decimal("15"),
            inr=Decimal("50000"),
            source_jeweller_id=self.src.id,
        )
        self.assertEqual(tier, "manual")
        self.assertIn("single_txn_grams", reasons)

    def test_authorize_creates_source_first_pending(self):
        out = authorize_cross_redemption(
            self.customer,
            source_jeweller_id=self.src.id,
            destination_jeweller_id=self.dst.id,
            grams=Decimal("12.000000"),
            estimated_value_inr=Decimal("80000"),
        )
        self.assertEqual(out["status"], "PENDING")
        req = CrossRedemptionRequest.objects.get(pk=out["request_id"])
        self.assertEqual(req.workflow_state, CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE)
        self.assertEqual(req.auth_tier, CrossRedemptionRequest.AuthTier.MANUAL)
        self.assertTrue(req.public_reference.startswith("CRX-"))
        self.assertIsNotNone(req.auth_expires_at)

    def test_small_txn_auto_approves(self):
        out = authorize_cross_redemption(
            self.customer,
            source_jeweller_id=self.src.id,
            destination_jeweller_id=self.dst.id,
            grams=Decimal("1.000000"),
            estimated_value_inr=Decimal("8000"),
        )
        self.assertEqual(out["status"], "APPROVE")
        req = CrossRedemptionRequest.objects.get(pk=out["request_id"])
        self.assertEqual(req.auth_tier, CrossRedemptionRequest.AuthTier.AUTO)
        self.assertNotEqual(req.workflow_state, CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE)
