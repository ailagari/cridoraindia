from django.test import SimpleTestCase

from apps.marketplace.goodreturns_kerala_rates import parse_goodreturns_inr


class GoodreturnsParseTests(SimpleTestCase):
    def test_parse_inr_strings(self):
        self.assertEqual(parse_goodreturns_inr("₹14,908"), parse_goodreturns_inr("\u20b914,908"))
        self.assertEqual(parse_goodreturns_inr("₹14,908"), 14908)
        self.assertEqual(parse_goodreturns_inr("₹119"), 119)
        self.assertIsNone(parse_goodreturns_inr(""))
        self.assertIsNone(parse_goodreturns_inr("n/a"))
