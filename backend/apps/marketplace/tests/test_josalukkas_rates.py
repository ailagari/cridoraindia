from unittest.mock import patch

from django.test import SimpleTestCase

from apps.marketplace.josalukkas_rates import (
    JOSALUKKAS_GOLD_URL,
    JOSALUKKAS_KERALA_URL,
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
        self.assertIn("21K", parsed["gold"])

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

    @patch("apps.marketplace.josalukkas_rates._http_get_html")
    def test_fetch_prefers_kerala_url_and_skips_goodreturns(self, mock_get):
        mock_get.side_effect = lambda url, timeout=12.0: SAMPLE_HTML if url == JOSALUKKAS_KERALA_URL else None
        parsed = fetch_josalukkas_rates_from_web()
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(parsed["gold"]["22K"], 13645.0)
        mock_get.assert_called_once_with(JOSALUKKAS_KERALA_URL)

    @patch("apps.marketplace.josalukkas_rates._http_get_html")
    def test_fetch_falls_back_to_india_url(self, mock_get):
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

    @patch("apps.marketplace.josalukkas_rates._http_get_html", return_value=None)
    def test_fetch_returns_none_without_third_party_substitute(self, _mock_get):
        self.assertIsNone(fetch_josalukkas_rates_from_web())
