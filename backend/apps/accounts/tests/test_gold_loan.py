from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.loan_service import (
    compare_loan_offers,
    create_pending_loan_request,
    customer_initiate_loan_repayment,
    customer_vault_loan_rates,
    jeweller_accept_loan_repayment,
    jeweller_complete_loan_repayment_with_otp,
    quote_customer_loan,
)
from apps.accounts.models import GoldLoanRequest, VaultHolding
from apps.accounts.vault_service import (
    credit_customer_deposit,
    credit_customer_fractional,
    customer_loan_collateral_locked_grams,
    customer_loan_eligible_grams,
    ensure_vault,
)
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

    def test_compare_api_accepts_grams_string(self):
        client = APIClient()
        client.force_authenticate(user=self.customer)
        res = client.post("/api/v1/gold/loans/compare/", {"grams": "10"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(int(res.json()["eligible_offer_count"]), 1)

    def test_vault_rates_include_net_per_gram(self):
        rows = customer_vault_loan_rates(self.customer)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["loan_available"], "true")
        self.assertGreater(Decimal(rows[0]["net_loan_inr_per_gram"]), Decimal("0"))


class GoldLoanLockRepayTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="loan-lock-cust",
            email="loan-lock-cust@test.com",
            password="x",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )
        self.jeweller = User.objects.create_user(
            username="loan-lock-j",
            email="loan-lock-j@test.com",
            password="x",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Lock Jeweller",
        )
        ticker = get_or_create_ticker()
        ticker.gold_loan_max_term_months = 12
        ticker.save()
        profile = jeweller_profile_for(self.jeweller)
        profile.feat_loan_available = True
        profile.gold_loan_ltv_percent = Decimal("98")
        profile.save()
        ensure_vault(self.customer, self.jeweller)
        credit_customer_fractional(self.customer, self.jeweller, Decimal("10"))

    def test_init_locks_collateral(self):
        self.assertEqual(customer_loan_eligible_grams(self.customer, self.jeweller), Decimal("10"))
        row, err, _code = create_pending_loan_request(
            self.customer, self.jeweller, Decimal("4"), term_months=6
        )
        self.assertIsNone(err)
        assert row is not None
        self.assertEqual(row.term_months, 6)
        self.assertEqual(customer_loan_eligible_grams(self.customer, self.jeweller), Decimal("6"))
        self.assertEqual(
            customer_loan_collateral_locked_grams(self.customer, self.jeweller), Decimal("4")
        )

    def test_partial_then_full_repay_releases_gold(self):
        from django.utils import timezone

        row, err, _ = create_pending_loan_request(
            self.customer, self.jeweller, Decimal("5"), term_months=12
        )
        self.assertIsNone(err)
        assert row is not None
        row.status = GoldLoanRequest.STATUS_DISBURSED
        row.disbursed_at = timezone.now()
        row.save(update_fields=["status", "disbursed_at", "updated_at"])
        principal = row.gross_principal_inr_snapshot
        half = (principal / 2).quantize(Decimal("0.01"))

        def settle(amount: Decimal):
            req, otp, ierr = customer_initiate_loan_repayment(
                self.customer, row.pk, amount
            )
            self.assertIsNone(ierr)
            assert req is not None and otp is not None
            ok, aerr = jeweller_accept_loan_repayment(self.jeweller, req.pk)
            self.assertTrue(ok, aerr)
            _req, payload, cerr = jeweller_complete_loan_repayment_with_otp(
                self.jeweller, req.pk, otp
            )
            self.assertIsNone(cerr)
            return payload

        payload = settle(half)
        assert payload is not None
        self.assertGreater(Decimal(payload["principal_outstanding_inr"]), Decimal("0"))
        row.refresh_from_db()
        remainder = row.principal_outstanding_inr
        settle(remainder)
        row.refresh_from_db()
        self.assertEqual(row.status, GoldLoanRequest.STATUS_REPAID)
        self.assertEqual(customer_loan_eligible_grams(self.customer, self.jeweller), Decimal("10"))
        vault = ensure_vault(self.customer, self.jeweller)
        locked = VaultHolding.objects.filter(
            vault=vault, holding_type=VaultHolding.LOAN_COLLATERAL
        ).first()
        self.assertTrue(not locked or locked.balance_grams == 0)
