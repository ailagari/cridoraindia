"""HTTP ping to the main app cron hook (for Railway cron containers without curl)."""

import json
import os
import urllib.error
import urllib.request

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "POST to /api/v1/internal/cron/process-festival-broadcasts/ using CRON_SECRET. "
        "Use when the cron container cannot run Django DB code directly."
    )

    def handle(self, *args, **options):
        secret = (os.environ.get("CRON_SECRET") or "").strip()
        if not secret:
            self.stderr.write(self.style.ERROR("CRON_SECRET is not set."))
            raise SystemExit(1)
        base = (
            os.environ.get("CRON_TARGET_URL")
            or os.environ.get("RAILWAY_PUBLIC_DOMAIN")
            or os.environ.get("RAILWAY_SERVICE_CRIDORAINDIA_URL")
            or "www.cridoraindia.com"
        ).strip()
        if not base.startswith("http"):
            base = f"https://{base.lstrip('/')}"
        url = f"{base.rstrip('/')}/api/v1/internal/cron/process-festival-broadcasts/"
        req = urllib.request.Request(
            url,
            method="POST",
            headers={"X-Cron-Secret": secret},
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                body = resp.read().decode()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode() if exc.fp else str(exc)
            self.stderr.write(self.style.ERROR(f"HTTP {exc.code}: {detail}"))
            raise SystemExit(1) from exc
        except urllib.error.URLError as exc:
            self.stderr.write(self.style.ERROR(f"Request failed: {exc}"))
            raise SystemExit(1) from exc
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = {"raw": body}
        finalized = data.get("finalized", data)
        self.stdout.write(self.style.SUCCESS(f"Cron hook OK: finalized={finalized}"))
