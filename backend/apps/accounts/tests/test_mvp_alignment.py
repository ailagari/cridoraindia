from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.gold_identity import (
    ROUTING_CUSTOMER_VAULT_UPI,
    ROUTING_PRIMARY_CRIDORA,
    ROUTING_VAULT_PUBLIC,
    normalize_cridora_vault_public_id,
    resolve_inbound_transfer_target,
)
from apps.accounts.models import GoldVault
from apps.accounts.phone_utils import normalize_in_phone
from apps.accounts.vault_routing_codes import format_routing_address, normalize_routing_address
from apps.accounts.vault_service import ensure_vault

User = get_user_model()


class Phase1MvpAlignmentTests(TestCase):
    def test_vault_card_address_normalizes(self):
        self.assertEqual(
            normalize_routing_address("8472-9105-306@cridora"),
            None,
        )
        self.assertEqual(
            normalize_cridora_vault_public_id("8472910536@cridora"),
            "8472910536@cridora",
        )
        self.assertEqual(
            normalize_cridora_vault_public_id("democustomer.gardencity@cridora"),
            "democustomer.gardencity@cridora",
        )

    def test_india_phone_normalize(self):
        self.assertEqual(normalize_in_phone("9876543210"), "919876543210")
        self.assertEqual(normalize_in_phone("+91 98765 43210"), "919876543210")

    def test_inbound_resolves_primary_card_at_cridora(self):
        j = User.objects.create_user(
            "j1@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="shop-a",
            gold_handle_local="shopvault",
        )
        c = User.objects.create_user(
            "c1@test.com",
            "pw",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            gold_handle_local="rahul",
            default_jeweller=j,
        )
        ensure_vault(c, j)
        c.refresh_from_db()
        self.assertTrue(c.gold_routing_code)
        inc = resolve_inbound_transfer_target(format_routing_address(c.gold_routing_code))
        self.assertIsNotNone(inc)
        assert inc is not None
        self.assertEqual(inc.recipient.pk, c.pk)
        self.assertEqual(inc.destination_custodian.pk, j.pk)
        self.assertEqual(inc.routing_kind, ROUTING_PRIMARY_CRIDORA)

    def test_inbound_resolves_vault_specific_card(self):
        j = User.objects.create_user(
            "j2@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="shop-b",
            gold_handle_local="jv2",
        )
        c = User.objects.create_user(
            "c2@test.com",
            "pw",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            gold_handle_local="meera",
            default_jeweller=j,
        )
        ensure_vault(c, j)
        v = GoldVault.objects.get(owner=c, custodian=j)
        self.assertTrue(v.vault_public_id)
        self.assertRegex(v.vault_public_id or "", r"^\d{10}@cridora$")
        inc = resolve_inbound_transfer_target(v.vault_public_id or "")
        self.assertIsNotNone(inc)
        assert inc is not None
        self.assertEqual(inc.routing_kind, ROUTING_VAULT_PUBLIC)
        self.assertEqual(inc.destination_custodian.pk, j.pk)

    def test_inbound_customer_vault_upi_uses_suffix_jeweller_not_only_default(self):
        j_a = User.objects.create_user(
            "ja@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="shop-a",
            gold_handle_local="jva",
        )
        j_b = User.objects.create_user(
            "jb@test.com",
            "pw",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            jeweller_code="shop-b",
            gold_handle_local="jvb",
        )
        c = User.objects.create_user(
            "cx@test.com",
            "pw",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            gold_handle_local="bindu",
            default_jeweller=j_a,
        )
        inc = resolve_inbound_transfer_target("bindu@shop-b")
        self.assertIsNotNone(inc)
        assert inc is not None
        self.assertEqual(inc.recipient.pk, c.pk)
        self.assertEqual(inc.destination_custodian.pk, j_b.pk)
        self.assertEqual(inc.routing_kind, ROUTING_CUSTOMER_VAULT_UPI)
