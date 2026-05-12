import base64
import json

from cryptography.hazmat.primitives import serialization
from django.core.management.base import BaseCommand
from py_vapid import Vapid01


class Command(BaseCommand):
    help = (
        "Print WEB_PUSH_VAPID_PUBLIC_KEY (URL-safe base64) and WEB_PUSH_VAPID_PRIVATE_KEY (PEM) for .env."
    )

    def handle(self, *args, **options):
        vapid = Vapid01()
        vapid.generate_keys()
        pub = vapid.public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint,
        )
        pub_b64 = base64.urlsafe_b64encode(pub).decode().rstrip("=")
        pem = vapid.private_pem().decode()
        self.stdout.write(self.style.SUCCESS("Add to your environment:\n"))
        self.stdout.write(f"WEB_PUSH_VAPID_PUBLIC_KEY={pub_b64}\n")
        self.stdout.write(f"WEB_PUSH_VAPID_PRIVATE_KEY={json.dumps(pem)}\n")
        self.stdout.write(
            "WEB_PUSH_VAPID_CONTACT=mailto:you@example.com  # required VAPID sub claim\n"
        )
