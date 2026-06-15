from unittest.mock import patch

from django.test import SimpleTestCase

from apps.marketplace.akgsma_rates import (
    AKGSMA_URL,
    fetch_akgsma_rates_from_web,
    parse_akgsma_rates_from_html,
)

SAMPLE_HTML = """
<h3>Today's Rate (15/06/2026)</h3>
<ul>
<li><strong>22K916 (1gm) - ₹ 13890</strong></li>
<li><strong>18K750 (1gm) - ₹ 11475</strong></li>
<li><strong>Silver (1gm) - ₹ 265</strong></li>
<li><strong>925 Hall Marked Silver (1gm) - ₹ NA</strong></li>
</ul>
"""


class AkgsmaRatesParseTests(SimpleTestCase):
    def test_parse_rates_and_derive_24k_silver_925(self):
        parsed = parse_akgsma_rates_from_html(SAMPLE_HTML)
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(parsed["source"], "akgsma_kerala")
        self.assertEqual(parsed["rate_date"], "2026-06-15")
        self.assertEqual(parsed["gold"]["22K"], 13890.0)
        self.assertEqual(parsed["gold"]["18K"], 11475.0)
        self.assertAlmostEqual(parsed["gold"]["24K"], round(13890 / 0.916, 2))
        self.assertEqual(parsed["silver"]["999"], 265.0)
        self.assertEqual(parsed["silver"]["925"], round(265 * 0.925, 3))

    def test_parse_requires_22k(self):
        self.assertIsNone(parse_akgsma_rates_from_html("<html></html>"))

    @patch("apps.marketplace.akgsma_rates._http_get_html")
    def test_fetch_from_web(self, mock_get):
        mock_get.return_value = SAMPLE_HTML
        parsed = fetch_akgsma_rates_from_web()
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(parsed["gold"]["22K"], 13890.0)
        mock_get.assert_called_once_with(AKGSMA_URL)
