from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase

from apps.marketplace.gold_price_poll import maybe_poll_platform_gold_for_alerts


class GoldPricePollTests(TestCase):
    def setUp(self):
        cache.clear()

    @patch("apps.marketplace.gold_price_events.ingest_platform_gold_price")
    @patch("apps.marketplace.spot_prices.resolve_cridora_base_22k_inr")
    @patch("apps.marketplace.spot_prices.refresh_live_kerala_feed")
    def test_poll_ingests_platform_rate(self, mock_refresh, mock_resolve, mock_ingest):
        mock_resolve.return_value = (Decimal("14105.00"), "kerala")
        mock_ingest.return_value = {
            "published": True,
            "previous_rate": "14100.00",
            "new_rate": "14105.00",
            "source": "poll:kerala",
        }
        out = maybe_poll_platform_gold_for_alerts(force=True)
        mock_refresh.assert_called_once_with(force_fetch=True)
        mock_ingest.assert_called_once()
        self.assertTrue(out.get("polled"))
        self.assertTrue(out.get("published"))

    @patch("apps.marketplace.gold_price_events.ingest_platform_gold_price")
    @patch("apps.marketplace.spot_prices.resolve_cridora_base_22k_inr")
    @patch("apps.marketplace.spot_prices.refresh_live_kerala_feed")
    def test_poll_throttles_without_force(self, mock_refresh, mock_resolve, mock_ingest):
        mock_resolve.return_value = (Decimal("14105.00"), "kerala")
        mock_ingest.return_value = {"published": False, "reason": "unchanged"}
        first = maybe_poll_platform_gold_for_alerts()
        second = maybe_poll_platform_gold_for_alerts()
        self.assertTrue(first.get("polled"))
        self.assertEqual(second.get("reason"), "throttled")
        self.assertEqual(mock_ingest.call_count, 1)
