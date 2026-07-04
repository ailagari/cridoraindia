"""Tests for Kerala public gold rates API."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.marketplace.models import AkgsmaBoardDailySnapshot, KeralaGoldRateDaily

User = get_user_model()

_MIN_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


class KeralaGoldRatesApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        today = timezone.localdate()
        AkgsmaBoardDailySnapshot.objects.create(
            snapshot_date=today,
            open_inr_22k=Decimal("7200.00"),
            high_inr_22k=Decimal("7210.00"),
            low_inr_22k=Decimal("7195.00"),
            close_inr_22k=Decimal("7205.00"),
            close_inr_18k=Decimal("5400.00"),
            close_inr_24k=Decimal("7865.00"),
            silver_999_inr=Decimal("92.50"),
            source="kerala_gold_rate",
        )
        KeralaGoldRateDaily.objects.create(
            rate_date=today,
            inr_per_gram_22k=Decimal("7205.00"),
            inr_per_gram_18k=Decimal("5400.00"),
            inr_per_gram_24k=Decimal("7865.00"),
            silver_999_inr=Decimal("92.50"),
            source="kerala_board",
        )

    def test_public_kerala_rates_payload(self):
        res = self.client.get("/api/v1/marketplace/kerala-gold-rates/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Access-Control-Allow-Origin"], "*")
        body = res.json()
        self.assertEqual(body.get("region"), "Kerala")
        self.assertIn("22K", body.get("gold", {}))

    def test_history_endpoint(self):
        res = self.client.get("/api/v1/marketplace/kerala-gold-rates/history/?range=1m&metal=22K")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body.get("metal"), "22K")
        self.assertGreaterEqual(len(body.get("points", [])), 1)

    def test_daily_table_endpoint(self):
        res = self.client.get("/api/v1/marketplace/kerala-gold-rates/daily/?limit=10")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertGreaterEqual(body.get("total", 0), 1)
        self.assertTrue(body.get("rows"))

    def test_ads_endpoint_seeds_placements(self):
        from apps.marketplace.models import GoldRatesAdPlacement

        res = self.client.get("/api/v1/marketplace/gold-rates/ads/")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("placements", body)
        self.assertGreaterEqual(GoldRatesAdPlacement.objects.count(), 1)


class AdminGoldRatesAdImageUploadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            "gold_rates_admin@test.com",
            "pass",
            user_type=User.ADMIN,
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            "gold_rates_cust@test.com",
            "pass",
            user_type=User.CUSTOMER,
        )

    def test_admin_can_upload_ad_image(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            "/api/v1/admin/gold-rates/ad-image/",
            {
                "file": SimpleUploadedFile("banner.png", _MIN_PNG, content_type="image/png"),
                "slot": "top_banner",
            },
            format="multipart",
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("image_url", body)
        self.assertTrue(str(body["image_url"]).startswith("http"))

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            "/api/v1/admin/gold-rates/ad-image/",
            {"file": SimpleUploadedFile("banner.png", _MIN_PNG, content_type="image/png")},
            format="multipart",
        )
        self.assertEqual(res.status_code, 403)
