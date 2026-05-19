from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.loan_service import compare_loan_offers, quote_customer_loan
from apps.accounts.vault_service import credit_customer_deposit, credit_customer_fractional, ensure_vault
from apps.marketplace.loan_policy import compute_loan_amounts
from apps.marketplace.models import JewellerPricingProfile, get_or_create_ticker, jeweller_profile_for

User = get_user_model()


class GoldLoanPolicyTests(TestCase):
    def test_compute_loan_amounts_example(self):
        amounts = compute_loan_amounts(
            grams=Decimal("10"),
            metal_inr_per_gram=Decimal("10"),
            ltv_percent=Decimal("98"),
            processing_fee_percent=Decimal("2"),
            processing_fee_jeweller_share_percent=Decimal("50"),
        )
        self.assertEqual(amounts["collateral_value_inr"], Decimal("100.00"))
        self.assertEqual(amounts["gross_principal_inr"], Decimal("98.00"))
        self.assertEqual(amounts["processing_fee_inr"], Decimal("1.96"))
        self.assertEqual(amounts["net_disbursement_inr"], Decimal("96.04"))


class GoldLoanQuoteTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="loan-cust",
            email="loan-cust@test.com",
            password="x",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )
        self.jeweller = User.objects.create_user(
            username="loan-j",
            email="loan-j@test.com",
            password="x",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Loan Jeweller",
        )
        ticker = get_or_create_ticker()
        ticker.gold_loan_ltv_min_percent = Decimal("95")
        ticker.gold_loan_ltv_max_percent = Decimal("99")
        ticker.gold_loan_processing_fee_percent = Decimal("2")
        ticker.save()
        profile = jeweller_profile_for(self.jeweller)
        profile.feat_loan_available = True
        profile.gold_loan_ltv_percent = Decimal("98")
        profile.save()
        ensure_vault(self.customer, self.jeweller)
        credit_customer_fractional(self.customer, self.jeweller, Decimal("5"))
        credit_customer_deposit(self.customer, self.jeweller, Decimal("5"))

    def test_quote_uses_vault_fractional_and_deposit(self):
        payload, err = quote_customer_loan(
            self.customer, self.jeweller, grams=Decimal("10")
        )
        self.assertIsNone(err)
        assert payload is not None
        self.assertEqual(payload["eligible_vault_balance_grams"], "10.000000")
        self.assertEqual(payload["ltv_percent"], "98.000")
        collateral = Decimal(payload["collateral_value_inr"])
        gross = Decimal(payload["gross_principal_inr"])
        self.assertEqual(gross, (collateral * Decimal("98") / Decimal("100")).quantize(Decimal("0.01")))

    def test_compare_lists_jeweller(self):
        payload, err = compare_loan_offers(self.customer, grams=Decimal("10"))
        self.assertIsNone(err)
        assert payload is not None
        self.assertEqual(int(payload["offer_count"]), 1)
        self.assertEqual(int(payload["eligible_offer_count"]), 1)
        self.assertEqual(payload["skip_compare"], "true")

    def test_compare_excludes_jewellers_without_customer_vault(self):
        other = User.objects.create_user(
            username="loan-j2",
            email="loan-j2@test.com",
            password="x",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Other Jeweller",
        )
        profile = jeweller_profile_for(other)
        profile.feat_loan_available = True
        profile.gold_loan_ltv_percent = Decimal("99")
        profile.save()
        payload, err = compare_loan_offers(self.customer, grams=Decimal("10"))
        self.assertIsNone(err)
        assert payload is not None
        jeweller_ids = {o["jeweller_id"] for o in payload["offers"]}
        self.assertIn(str(self.jeweller.id), jeweller_ids)
        self.assertNotIn(str(other.id), jeweller_ids)

    def test_ltv_out_of_range_rejected_on_profile(self):
        profile = JewellerPricingProfile.objects.get(jeweller=self.jeweller)
        profile.gold_loan_ltv_percent = Decimal("50")
        profile.save()
        _, err = quote_customer_loan(
            self.customer, self.jeweller, grams=Decimal("1")
        )
        self.assertIn("not offering", err or "")
