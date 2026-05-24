"""Treasury desk, platform fees, settlement summary, and payment confirm."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from apps.accounts.models import (
    FractionalGoldPurchase,
    GoldDepositIntake,
    PlatformCommercialLedgerEntry,
    PlatformOperationalSettings,
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

    def test_payment_confirm_marks_entries_settled(self):
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
        receipt = SimpleUploadedFile("rcpt.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        self.client.force_authenticate(self.jeweller)
        create = self.client.post(
            "/api/v1/jeweller/treasury/payments/",
            {"amount_inr": "35.00", "utr": "123456789012", "receipt_file": receipt},
            format="multipart",
        )
        self.assertEqual(create.status_code, 201)
        payment_id = create.json()["id"]
        self.client.force_authenticate(self.admin)
        confirm = self.client.post(f"/api/v1/admin/treasury/payments/{payment_id}/confirm/", {})
        self.assertEqual(confirm.status_code, 200)
        entry.refresh_from_db()
        self.assertEqual(entry.status, PlatformCommercialLedgerEntry.STATUS_SETTLED)
        payment = PlatformSettlementPayment.objects.get(pk=payment_id)
        self.assertEqual(payment.status, PlatformSettlementPayment.STATUS_CONFIRMED)

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
