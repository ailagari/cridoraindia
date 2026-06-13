from django.test import SimpleTestCase

from apps.marketplace.josalukkas_rates import (
    build_spot_payload_from_josalukkas,
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

    def test_parse_requires_22k(self):
        self.assertIsNone(parse_josalukkas_rates_from_html("<html></html>"))
