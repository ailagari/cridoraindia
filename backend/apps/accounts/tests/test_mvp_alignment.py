from django.test import TestCase

from apps.accounts.gold_identity import normalize_cridora_vault_public_id
from apps.accounts.phone_utils import normalize_in_phone


class Phase1MvpAlignmentTests(TestCase):
    def test_vault_public_id_normalizes(self):
        self.assertEqual(
            normalize_cridora_vault_public_id("Rahul4821.goldhouse-kochi@cridora"),
            "rahul4821.goldhouse-kochi@cridora",
        )
        self.assertIsNone(normalize_cridora_vault_public_id("bad"))

    def test_india_phone_normalize(self):
        self.assertEqual(normalize_in_phone("9876543210"), "919876543210")
        self.assertEqual(normalize_in_phone("+91 98765 43210"), "919876543210")
