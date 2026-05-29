import base64
import json

from cryptography.hazmat.primitives import serialization
from django.test import SimpleTestCase
from py_vapid import Vapid, Vapid01

from apps.accounts.vapid_utils import load_vapid_private_key, normalize_vapid_private_key_env, vapid_signer_ready


class VapidUtilsTests(SimpleTestCase):
    def test_pem_json_quoted_loads_for_signing(self):
        vapid = Vapid01()
        vapid.generate_keys()
        pem = vapid.private_pem().decode()
        env_value = json.dumps(pem)
        normalized = normalize_vapid_private_key_env(env_value)
        self.assertIn("BEGIN", normalized)
        signer = load_vapid_private_key(env_value)
        self.assertIsNotNone(signer.private_key)
        pub = vapid.public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint,
        )
        pub_b64 = base64.urlsafe_b64encode(pub).decode().rstrip("=")
        self.assertTrue(vapid_signer_ready(pub_b64, env_value))

    def test_pywebpush_from_string_fails_on_pem(self):
        vapid = Vapid01()
        vapid.generate_keys()
        pem = vapid.private_pem().decode()
        with self.assertRaises(Exception):
            Vapid.from_string(pem)
