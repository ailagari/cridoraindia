"""Tests for public-facing rate copy (no third-party names)."""

from django.test import SimpleTestCase

from apps.marketplace.public_rate_copy import (
    CRIDORA_LIVE_RATE_LABEL,
    attach_public_rate_labels,
    sanitize_public_rate_note,
)


class PublicRateCopyTests(SimpleTestCase):
    def test_sanitize_strips_third_party_names(self):
        note = "Jos Alukkas gold rate (24K / 22K / 18K) — indicative India reference."
        cleaned = sanitize_public_rate_note(note, source="kerala_gold_rate")
        self.assertNotIn("Jos", cleaned or "")
        self.assertNotIn("Alukkas", cleaned or "")

    def test_attach_labels_on_spot_payload(self):
        payload = attach_public_rate_labels(
            {
                "source": "kerala_gold_rate",
                "note": "Jos Alukkas gold rate — feed temporarily unavailable.",
                "gold": {"22K": 13645.0},
                "kerala_board": {"source": "goodreturns_kerala", "gold": {"22K": 13645.0}},
            }
        )
        self.assertEqual(payload["source_label"], CRIDORA_LIVE_RATE_LABEL)
        self.assertNotIn("source", payload["kerala_board"])
        self.assertEqual(payload["kerala_board"]["source_label"], CRIDORA_LIVE_RATE_LABEL)
        self.assertNotIn("Jos", payload["note"])
