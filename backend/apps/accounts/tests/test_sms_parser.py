from decimal import Decimal

from django.test import TestCase

from apps.accounts.services.payment_reconciliation.sms_parser import parse_sms


class SmsParserTests(TestCase):
    def test_parse_hdfc_style_sms(self):
        text = (
            "Rs.1000 debited from A/c XX1234\n"
            "UPI Ref No 123456789012 to j@upi"
        )
        parsed = parse_sms(text)
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(parsed.utr, "123456789012")
        self.assertEqual(parsed.amount_inr, Decimal("1000.00"))
        self.assertEqual(parsed.receiver_vpa, "j@upi")

    def test_parse_empty_returns_none(self):
        self.assertIsNone(parse_sms(""))
        self.assertIsNone(parse_sms("   "))
