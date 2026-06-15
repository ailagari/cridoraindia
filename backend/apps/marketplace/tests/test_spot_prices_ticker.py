"""Spot prices + ticker source switching (manual vs live Kerala board)."""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from apps.marketplace.public_rate_copy import CRIDORA_LIVE_RATE_NOTE
from apps.marketplace.models import get_or_create_ticker
from apps.marketplace.spot_prices import (
    get_raw_spot_payload_for_admin_preview,
    invalidate_spot_price_cache,
    public_spot_prices_payload,
)

KERALA_LIVE = {
    "currency": "INR",
    "unit": "per_gram",
    "source": "kerala_gold_rate",
    "note": CRIDORA_LIVE_RATE_NOTE,
    "source_updated_at": "10-06-26, 9:33:21 AM",
    "rate_date": "2026-06-10",
    "gold": {"24K": 14890.0, "22K": 13645.0, "18K": 11270.0, "21K": 13028.75},
    "silver": {"999": 95.5, "925": 88.34},
}


class SpotPricesTickerSourceTests(TestCase):
    def setUp(self):
        invalidate_spot_price_cache(force_kerala_refresh=True)
        self.ticker = get_or_create_ticker()
        self.ticker.manual_ticker_enabled = False
        self.ticker.ticker_manual_22k_inr_per_gram = None
        self.ticker.save(
            update_fields=[
                "manual_ticker_enabled",
                "ticker_manual_22k_inr_per_gram",
            ]
        )

    @patch("apps.marketplace.josalukkas_rates.get_josalukkas_spot_payload_cached")
    def test_live_mode_uses_kerala_board_not_manual(self, mock_feed):
        mock_feed.return_value = dict(KERALA_LIVE)
        invalidate_spot_price_cache(force_kerala_refresh=True)

        payload = public_spot_prices_payload()
        self.assertEqual(payload.get("source"), "kerala_gold_rate")
        self.assertNotEqual(payload.get("source"), "manual_ticker")
        self.assertEqual(payload["gold"]["22K"], 13645.0)
        self.assertEqual(payload["kerala_board"]["gold"]["22K"], 13645.0)

    @patch("apps.marketplace.josalukkas_rates.get_josalukkas_spot_payload_cached")
    def test_manual_mode_overrides_kerala_feed(self, mock_feed):
        mock_feed.return_value = dict(KERALA_LIVE)
        self.ticker.manual_ticker_enabled = True
        self.ticker.ticker_manual_22k_inr_per_gram = Decimal("9999.00")
        self.ticker.save()
        invalidate_spot_price_cache(force_kerala_refresh=True)

        payload = public_spot_prices_payload()
        self.assertEqual(payload.get("source"), "manual_ticker")
        self.assertEqual(payload["gold"]["22K"], 9999.0)
        self.assertIn("kerala_board", payload)
        self.assertEqual(payload["kerala_board"]["gold"]["22K"], 13645.0)

    @patch("apps.marketplace.josalukkas_rates.get_josalukkas_spot_payload_cached")
    def test_manual_mode_admin_payload_includes_live_raw(self, mock_feed):
        mock_feed.return_value = dict(KERALA_LIVE)
        self.ticker.manual_ticker_enabled = True
        self.ticker.ticker_manual_22k_inr_per_gram = Decimal("9999.00")
        self.ticker.save()
        invalidate_spot_price_cache(force_kerala_refresh=True)

        payload = public_spot_prices_payload(include_live_raw=True)
        self.assertEqual(payload.get("source"), "manual_ticker")
        self.assertIsNotNone(payload.get("live_raw_spot"))
        self.assertEqual(payload["live_raw_spot"]["gold"]["22K"], 13645.0)

    @patch("apps.marketplace.josalukkas_rates.get_josalukkas_spot_payload_cached")
    def test_switching_off_manual_returns_kerala_rates(self, mock_feed):
        mock_feed.return_value = dict(KERALA_LIVE)

        self.ticker.manual_ticker_enabled = True
        self.ticker.ticker_manual_22k_inr_per_gram = Decimal("8888.00")
        self.ticker.save()
        manual_payload = public_spot_prices_payload()
        self.assertEqual(manual_payload["gold"]["22K"], 8888.0)

        self.ticker.manual_ticker_enabled = False
        self.ticker.save(update_fields=["manual_ticker_enabled"])
        invalidate_spot_price_cache(force_kerala_refresh=True)

        live_payload = public_spot_prices_payload()
        self.assertEqual(live_payload.get("source"), "kerala_gold_rate")
        self.assertEqual(live_payload["gold"]["22K"], 13645.0)

    @patch("apps.marketplace.josalukkas_rates.get_josalukkas_spot_payload_cached")
    def test_admin_preview_raw_matches_kerala_feed(self, mock_feed):
        mock_feed.return_value = dict(KERALA_LIVE)
        raw = get_raw_spot_payload_for_admin_preview()
        self.assertEqual(raw.get("source"), "kerala_gold_rate")
        self.assertEqual(raw["gold"]["22K"], 13645.0)
