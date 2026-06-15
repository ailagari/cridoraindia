from unittest.mock import patch

from django.test import SimpleTestCase

from apps.marketplace.josalukkas_rates import (
    JOSALUKKAS_GOLD_URL,
    JOSALUKKAS_KERALA_URL,
    _merge_goodreturns_gaps,
    _payload_fingerprint,
    build_spot_payload_from_josalukkas,
    fetch_josalukkas_rates_from_web,
    parse_josalukkas_rates_from_html,
)

SAMPLE_HTML = """
<div class="card-bottom">
  <span class="update-text">Updated on: <strong>10-06-26, 9:33:21 AM</strong></span>
</div>
<div class="rate-container">
  <div class="carat-card featured">
    <div class="carat-label"><span class="karat">24K Gold </span><span class="unit">/ gram</span></div>
    <div class="carat-price"><span class="amount">₹14,890</span></div>
  </div>
  <div class="carat-card featured">
    <div class="carat-label"><span class="karat">22K Gold </span><span class="unit">/ gram</span></div>
    <div class="carat-price"><span class="amount">₹13,645</span></div>
  </div>
  <div class="carat-card featured">
    <div class="carat-label"><span class="karat">18K Gold </span><span class="unit">/ gram</span></div>
    <div class="carat-price"><span class="amount">₹11,270</span></div>
  </div>
</div>
"""

JOS_BOARD = {
    "gold": {"24K": 14890.0, "22K": 13645.0, "18K": 11270.0},
    "silver": {},
    "source_updated_at": "10-06-26, 9:33:21 AM",
    "rate_date": "2026-06-10",
    "source": "kerala_gold_rate",
}

GR_GOLD = {"24K": 15153.0, "22K": 13890.0, "18K": 11365.0}
GR_SILVER = {"999": 95.5, "925": 88.34}


class JosAlukkasRatesParseTests(SimpleTestCase):
    def test_parse_rates_and_fingerprint(self):
        parsed = parse_josalukkas_rates_from_html(SAMPLE_HTML)
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(parsed["source_updated_at"], "10-06-26, 9:33:21 AM")
        self.assertEqual(parsed["rate_date"], "2026-06-10")
        self.assertEqual(parsed["gold"]["24K"], 14890.0)
        self.assertEqual(parsed["gold"]["22K"], 13645.0)
        self.assertEqual(parsed["gold"]["18K"], 11270.0)
        self.assertNotIn("21K", parsed["gold"])

    def test_build_spot_payload(self):
        parsed = parse_josalukkas_rates_from_html(SAMPLE_HTML)
        assert parsed is not None
        payload = build_spot_payload_from_josalukkas(parsed)
        self.assertEqual(payload["source"], "kerala_gold_rate")
        self.assertEqual(payload["gold"]["22K"], 13645.0)
        self.assertEqual(payload["source_updated_at"], "10-06-26, 9:33:21 AM")

    def test_payload_fingerprint_includes_prices(self):
        parsed = parse_josalukkas_rates_from_html(SAMPLE_HTML)
        assert parsed is not None
        fp = _payload_fingerprint(parsed)
        self.assertIn("13645.0", fp)
        self.assertIn("10-06-26", fp)

    def test_parse_requires_22k(self):
        self.assertIsNone(parse_josalukkas_rates_from_html("<html></html>"))

    @patch("apps.marketplace.josalukkas_rates._goodreturns_silver_for_today", return_value=GR_SILVER)
    @patch("apps.marketplace.josalukkas_rates._goodreturns_gold_for_today", return_value=GR_GOLD)
    def test_merge_goodreturns_fills_silver_without_overwriting_jos_gold(self, _mock_gold, _mock_silver):
        merged = _merge_goodreturns_gaps(dict(JOS_BOARD))
        self.assertEqual(merged["gold"]["22K"], 13645.0)
        self.assertEqual(merged["gold"]["24K"], 14890.0)
        self.assertNotIn("21K", merged["gold"])
        self.assertEqual(merged["silver"]["999"], 95.5)
        self.assertEqual(merged["silver"]["925"], 88.34)
        self.assertIn("silver:goodreturns", merged.get("gaps_filled_from", []))

    @patch("apps.marketplace.josalukkas_rates._merge_goodreturns_gaps", side_effect=lambda b: b)
    @patch("apps.marketplace.josalukkas_rates._http_get_html")
    def test_fetch_prefers_kerala_url(self, mock_get, _mock_merge):
        mock_get.side_effect = lambda url, timeout=12.0: SAMPLE_HTML if url == JOSALUKKAS_KERALA_URL else None
        parsed = fetch_josalukkas_rates_from_web()
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(parsed["gold"]["22K"], 13645.0)
        mock_get.assert_called_once_with(JOSALUKKAS_KERALA_URL)

    @patch("apps.marketplace.josalukkas_rates._merge_goodreturns_gaps", side_effect=lambda b: b)
    @patch("apps.marketplace.josalukkas_rates._http_get_html")
    def test_fetch_falls_back_to_india_url(self, mock_get, _mock_merge):
        def _get(url, timeout=12.0):
            if url == JOSALUKKAS_KERALA_URL:
                return None
            if url == JOSALUKKAS_GOLD_URL:
                return SAMPLE_HTML
            return None

        mock_get.side_effect = _get
        parsed = fetch_josalukkas_rates_from_web()
        self.assertIsNotNone(parsed)
        self.assertEqual(mock_get.call_count, 2)

    @patch("apps.marketplace.josalukkas_rates._fetch_goodreturns_today_parsed")
    @patch("apps.marketplace.josalukkas_rates._http_get_html", return_value=None)
    def test_fetch_falls_back_to_goodreturns_when_jos_unavailable(self, _mock_get, mock_gr):
        mock_gr.return_value = {
            "gold": GR_GOLD,
            "silver": GR_SILVER,
            "source": "goodreturns_kerala",
            "source_updated_at": "2026-06-15",
            "rate_date": "2026-06-15",
        }
        parsed = fetch_josalukkas_rates_from_web()
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(parsed["source"], "goodreturns_kerala")
        self.assertEqual(parsed["gold"]["22K"], 13890.0)
        mock_gr.assert_called_once()
