from django.conf import settings
from django.core.management.base import BaseCommand

from apps.accounts.vapid_utils import load_vapid_private_key, vapid_signer_ready


class Command(BaseCommand):
    help = "Verify WEB_PUSH_VAPID_* env vars load and can sign (PEM-safe)."

    def handle(self, *args, **options):
        pub = (getattr(settings, "WEB_PUSH_VAPID_PUBLIC_KEY", "") or "").strip()
        priv = (getattr(settings, "WEB_PUSH_VAPID_PRIVATE_KEY", "") or "").strip()
        contact = (getattr(settings, "WEB_PUSH_VAPID_CONTACT", "") or "").strip()
        if not pub or not priv:
            self.stderr.write(self.style.ERROR("WEB_PUSH_VAPID_PUBLIC_KEY and PRIVATE_KEY are required."))
            return
        if not contact.startswith("mailto:"):
            self.stderr.write(self.style.WARNING("WEB_PUSH_VAPID_CONTACT should be mailto:..."))
        try:
            signer = load_vapid_private_key(priv)
            signer.sign({"aud": "https://example.com", "sub": contact or "mailto:ops@cridora.in"})
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"VAPID signing failed: {exc}"))
            return
        ready = vapid_signer_ready(pub, priv)
        self.stdout.write(self.style.SUCCESS(f"VAPID OK (signing_ready={ready}, public_key_len={len(pub)})"))
