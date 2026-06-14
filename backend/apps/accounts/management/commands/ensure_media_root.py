"""Create MEDIA_ROOT on startup (required when DJANGO_MEDIA_ROOT points at a Railway volume)."""
import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

_GOLD_RATES_SUBDIRS = (
    "gold_rates_ad_images",
    "gold_rates_ad_videos",
)


def _uses_persistent_volume() -> bool:
    return bool(
        (os.environ.get("DJANGO_MEDIA_ROOT") or "").strip()
        or (os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") or "").strip()
    )


class Command(BaseCommand):
    help = (
        "Ensure MEDIA_ROOT exists and is writable. "
        "Run on container start when using a persistent volume (e.g. Railway)."
    )

    def handle(self, *args, **options):
        if not settings.DEBUG and not _uses_persistent_volume():
            self.stdout.write(
                self.style.WARNING(
                    "WARNING: No persistent media volume configured. "
                    "Uploads (gold rates banners, KYC, logos) will be lost on every redeploy. "
                    "Attach a Railway volume at /data and set DJANGO_MEDIA_ROOT=/data/media "
                    "(or mount /data only - Django uses RAILWAY_VOLUME_MOUNT_PATH automatically). "
                    "See docs/RAILWAY_MEDIA.md."
                )
            )

        root = Path(settings.MEDIA_ROOT)
        root.mkdir(parents=True, exist_ok=True)
        for name in _GOLD_RATES_SUBDIRS:
            (root / name).mkdir(parents=True, exist_ok=True)
        self.stdout.write(self.style.SUCCESS(f"Media root ready: {root}"))
