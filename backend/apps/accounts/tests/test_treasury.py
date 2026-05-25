"""Treasury desk, platform fees, settlement summary, and payment confirm."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.accounts.models import (
    FractionalGoldPurchase,
    GoldDepositIntake,
    PlatformCommercialLedgerEntry,
    PlatformOperationalSettings,
    PlatformSettlementBatch,
    PlatformSettlementOtp,
    PlatformSettlementPayment,
)
from apps.accounts.platform_commercial_service import record_spread_fee_on_fractional_confirm
from apps.accounts.services.platform_treasury_ledger import platform_settlement_summary_payload
from apps.marketplace.models import JewellerPricingProfile, jeweller_profile_for

User = get_user_model()


class TreasuryDeskTests(APITestCase):
    def setUp(self):
        self.jeweller = User.objects.create_user(
            "treasury_j@test.com",
            "pass",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Treasury Jewellers",
        )
        self.customer = User.objects.create_user(
            "treasury_c@test.com",
            "pass",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            default_jeweller=self.jeweller,
        )
        self.admin = User.objects.create_user(
            "treasury_admin@test.com",
            "pass",
            user_type=User.ADMIN,
            is_staff=True,
        )
        profile = jeweller_profile_for(self.jeweller)
        profile.gold_rate_source = JewellerPricingProfile.GOLD_RATE_MANUAL
        profile.manual_gold_rate_inr_per_gram = Decimal("7000.00")
        profile.save()
        PlatformOperationalSettings.objects.get_or_create(
            defaults={"fractional_markup_percent": Decimal("1.000")}
        )
        settings_row = PlatformOperationalSettings.objects.first()
        if settings_row:
            settings_row.fractional_markup_percent = Decimal("1.000")
            settings_row.save(update_fields=["fractional_markup_percent"])

    def _pending_fee_entry(self, amount: str = "35.00") -> PlatformCommercialLedgerEntry:
        purchase = FractionalGoldPurchase.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            grams=Decimal("0.5"),
            metal_rate_inr_per_gram=Decimal("7000"),
            gold_value_inr_pre_gst=Decimal("3500"),
            gst_inr=Decimal("105"),
            total_inr=Decimal("3605"),
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status=FractionalGoldPurchase.COMPLETED,
        )
        return PlatformCommercialLedgerEntry.objects.create(
            jeweller=self.jeweller,
            fractional_purchase=purchase,
            amount_inr=Decimal(amount),
            kind=PlatformCommercialLedgerEntry.KIND_SPREAD_FEE,
            status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
        )

    def test_unified_desk_returns_fractional_and_deposit_rows(self):
        FractionalGoldPurchase.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            grams=Decimal("0.5"),
            metal_rate_inr_per_gram=Decimal("7000"),
            gold_value_inr_pre_gst=Decimal("3500"),
            gst_inr=Decimal("105"),
            total_inr=Decimal("3605"),
            payment_method=FractionalGoldPurchase.PAY_COUNTER,
            status=FractionalGoldPurchase.AWAITING_COUNTER,
        )
        GoldDepositIntake.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            grams=Decimal("1"),
            purity_karat="22",
            reference_metal_inr_per_gram=Decimal("7000"),
            estimated_value_inr=Decimal("7000"),
            status=GoldDepositIntake.AWAITING_CUSTOMER_OTP,
        )
        self.client.force_authenticate(self.jeweller)
        res = self.client.get("/api/v1/jeweller/desk/transactions/?bucket=pending")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        types = {r["transaction_type"] for r in body["results"]}
        self.assertIn("fractional", types)
        self.assertIn("deposit", types)

    def test_counter_fractional_verify_records_spread_fee(self):
        purchase = FractionalGoldPurchase.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            grams=Decimal("0.5"),
            metal_rate_inr_per_gram=Decimal("7000"),
            gold_value_inr_pre_gst=Decimal("3500"),
            gst_inr=Decimal("105"),
            total_inr=Decimal("3605"),
            payment_method=FractionalGoldPurchase.PAY_COUNTER,
            status=FractionalGoldPurchase.COMPLETED,
        )
        entry = record_spread_fee_on_fractional_confirm(purchase)
        self.assertIsNotNone(entry)
        self.assertEqual(
            PlatformCommercialLedgerEntry.objects.filter(
                fractional_purchase=purchase,
                kind=PlatformCommercialLedgerEntry.KIND_SPREAD_FEE,
            ).count(),
            1,
        )

    def test_settlement_summary_matches_pending_ledger(self):
        purchase = FractionalGoldPurchase.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            grams=Decimal("0.5"),
            metal_rate_inr_per_gram=Decimal("7000"),
            gold_value_inr_pre_gst=Decimal("3500"),
            gst_inr=Decimal("105"),
            total_inr=Decimal("3605"),
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status=FractionalGoldPurchase.COMPLETED,
        )
        PlatformCommercialLedgerEntry.objects.create(
            jeweller=self.jeweller,
            fractional_purchase=purchase,
            amount_inr=Decimal("35.00"),
            kind=PlatformCommercialLedgerEntry.KIND_SPREAD_FEE,
            status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
        )
        summary = platform_settlement_summary_payload()
        row = next(
            (r for r in summary["jewellers_owe_platform_inr"] if r["jeweller_id"] == self.jeweller.id),
            None,
        )
        self.assertIsNotNone(row)
        self.assertEqual(row["pending_inr"], "35.00")

    def test_payment_otp_verify_marks_entries_settled(self):
        purchase = FractionalGoldPurchase.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            grams=Decimal("0.5"),
            metal_rate_inr_per_gram=Decimal("7000"),
            gold_value_inr_pre_gst=Decimal("3500"),
            gst_inr=Decimal("105"),
            total_inr=Decimal("3605"),
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status=FractionalGoldPurchase.COMPLETED,
        )
        entry = PlatformCommercialLedgerEntry.objects.create(
            jeweller=self.jeweller,
            fractional_purchase=purchase,
            amount_inr=Decimal("35.00"),
            kind=PlatformCommercialLedgerEntry.KIND_SPREAD_FEE,
            status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
        )
        self.client.force_authenticate(self.jeweller)
        create = self.client.post(
            "/api/v1/jeweller/treasury/payments/initiate/",
            {"amount_inr": "35.00", "payment_method": "otp"},
            format="json",
        )
        self.assertEqual(create.status_code, 201)
        payment_id = create.json()["id"]
        issue = self.client.post(f"/api/v1/jeweller/treasury/payments/{payment_id}/otp/issue/", {}, format="json")
        self.assertEqual(issue.status_code, 200)
        otp = issue.json()["otp"]
        self.client.force_authenticate(self.admin)
        verify = self.client.post(
            f"/api/v1/admin/treasury/payments/{payment_id}/otp/verify/",
            {"otp": otp},
            format="json",
        )
        self.assertEqual(verify.status_code, 200)
        entry.refresh_from_db()
        self.assertEqual(entry.status, PlatformCommercialLedgerEntry.STATUS_SETTLED)
        payment = PlatformSettlementPayment.objects.get(pk=payment_id)
        self.assertEqual(payment.status, PlatformSettlementPayment.STATUS_CONFIRMED)

    def test_settlement_upi_submit_and_admin_approve(self):
        entry = self._pending_fee_entry()
        self.client.force_authenticate(self.jeweller)
        create = self.client.post(
            "/api/v1/jeweller/treasury/payments/initiate/",
            {"amount_inr": "35.00", "payment_method": "upi"},
            format="json",
        )
        self.assertEqual(create.status_code, 201)
        payment_id = create.json()["id"]
        submit = self.client.post(
            f"/api/v1/upi/settlement/{payment_id}/submit-utr/",
            {"utr": "987654321098"},
            format="json",
        )
        self.assertEqual(submit.status_code, 200)
        self.client.force_authenticate(self.admin)
        approve = self.client.post(f"/api/v1/upi/settlement/{payment_id}/approve/", {}, format="json")
        self.assertEqual(approve.status_code, 200)
        entry.refresh_from_db()
        self.assertEqual(entry.status, PlatformCommercialLedgerEntry.STATUS_SETTLED)
        payment = PlatformSettlementPayment.objects.get(pk=payment_id)
        self.assertEqual(payment.status, PlatformSettlementPayment.STATUS_CONFIRMED)

    def test_platform_to_jeweller_otp_verify(self):
        PlatformSettlementBatch.objects.create(
            jeweller=self.jeweller,
            period_label="credit-test",
            net_payable_inr=Decimal("-50.00"),
        )
        self.client.force_authenticate(self.admin)
        create = self.client.post(
            "/api/v1/admin/treasury/payments/initiate/",
            {
                "jeweller_id": self.jeweller.pk,
                "amount_inr": "50.00",
                "payment_method": "otp",
                "direction": PlatformSettlementPayment.DIR_PLATFORM_TO_JEWELLER,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201)
        payment_id = create.json()["id"]
        issue = self.client.post(f"/api/v1/admin/treasury/payments/{payment_id}/otp/issue/", {}, format="json")
        self.assertEqual(issue.status_code, 200)
        otp = issue.json()["otp"]
        self.client.force_authenticate(self.jeweller)
        verify = self.client.post(
            f"/api/v1/jeweller/treasury/payments/{payment_id}/otp/verify/",
            {"otp": otp},
            format="json",
        )
        self.assertEqual(verify.status_code, 200)
        payment = PlatformSettlementPayment.objects.get(pk=payment_id)
        self.assertEqual(payment.status, PlatformSettlementPayment.STATUS_CONFIRMED)

    def test_settlement_otp_wrong_code_increments_failures(self):
        self._pending_fee_entry()
        self.client.force_authenticate(self.jeweller)
        create = self.client.post(
            "/api/v1/jeweller/treasury/payments/initiate/",
            {"amount_inr": "35.00", "payment_method": "otp"},
            format="json",
        )
        payment_id = create.json()["id"]
        issue = self.client.post(f"/api/v1/jeweller/treasury/payments/{payment_id}/otp/issue/", {}, format="json")
        otp = issue.json()["otp"]
        self.client.force_authenticate(self.admin)
        bad = self.client.post(
            f"/api/v1/admin/treasury/payments/{payment_id}/otp/verify/",
            {"otp": "000000"},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)
        otp_row = PlatformSettlementOtp.objects.get(payment_id=payment_id)
        self.assertEqual(otp_row.failed_attempts, 1)
        good = self.client.post(
            f"/api/v1/admin/treasury/payments/{payment_id}/otp/verify/",
            {"otp": otp},
            format="json",
        )
        self.assertEqual(good.status_code, 200)

    def test_jeweller_settlement_ledger_shows_pending_fees(self):
        purchase = FractionalGoldPurchase.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            grams=Decimal("0.5"),
            metal_rate_inr_per_gram=Decimal("7000"),
            gold_value_inr_pre_gst=Decimal("3500"),
            gst_inr=Decimal("105"),
            total_inr=Decimal("3605"),
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status=FractionalGoldPurchase.COMPLETED,
        )
        PlatformCommercialLedgerEntry.objects.create(
            jeweller=self.jeweller,
            fractional_purchase=purchase,
            amount_inr=Decimal("35.00"),
            kind=PlatformCommercialLedgerEntry.KIND_SPREAD_FEE,
            status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
        )
        from apps.accounts.jeweller_revenue_service import record_fractional_sale_revenue

        record_fractional_sale_revenue(purchase)
        self.client.force_authenticate(self.jeweller)
        res = self.client.get("/api/v1/jeweller/treasury/ledger/")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["count"], 1)
        row = body["results"][0]
        self.assertEqual(row["reference"], f"FR-{purchase.id}")
        self.assertEqual(row["platform_fee_inr"], "35.00")
        self.assertEqual(row["transaction_amount_inr"], "3605.00")
        self.assertEqual(row["jeweller_revenue_inr"], "3605.00")
        self.assertEqual(body["totals"]["platform_fee_inr"], "35.00")

    def test_jeweller_summary_net_payable(self):
        purchase = FractionalGoldPurchase.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            grams=Decimal("0.5"),
            metal_rate_inr_per_gram=Decimal("7000"),
            gold_value_inr_pre_gst=Decimal("3500"),
            gst_inr=Decimal("105"),
            total_inr=Decimal("3605"),
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status=FractionalGoldPurchase.COMPLETED,
        )
        PlatformCommercialLedgerEntry.objects.create(
            jeweller=self.jeweller,
            fractional_purchase=purchase,
            amount_inr=Decimal("35.00"),
            kind=PlatformCommercialLedgerEntry.KIND_SPREAD_FEE,
            status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
        )
        self.client.force_authenticate(self.jeweller)
        res = self.client.get("/api/v1/jeweller/treasury/summary/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["net_payable_inr"], "35.00")
        self.assertEqual(res.json()["direction"], "pay")

    def test_export_csv_returns_rows(self):
        purchase = FractionalGoldPurchase.objects.create(
            customer=self.customer,
            jeweller=self.jeweller,
            grams=Decimal("0.5"),
            metal_rate_inr_per_gram=Decimal("7000"),
            gold_value_inr_pre_gst=Decimal("3500"),
            gst_inr=Decimal("105"),
            total_inr=Decimal("3605"),
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status=FractionalGoldPurchase.COMPLETED,
        )
        PlatformCommercialLedgerEntry.objects.create(
            jeweller=self.jeweller,
            fractional_purchase=purchase,
            amount_inr=Decimal("35.00"),
            kind=PlatformCommercialLedgerEntry.KIND_SPREAD_FEE,
            status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
        )
        from apps.accounts.services.platform_treasury_ledger import treasury_report_csv

        csv_body = treasury_report_csv(group_by="feature", from_date=None, to_date=None)
        self.assertIn("feature", csv_body.lower())
        self.assertGreater(csv_body.count("\n"), 1)

        self.client.force_authenticate(self.admin)
        res = self.client.get("/api/v1/admin/treasury/export/?group_by=feature&output=csv")
        self.assertEqual(res.status_code, 200)
        self.assertIn("feature", res.content.decode("utf-8").lower())
