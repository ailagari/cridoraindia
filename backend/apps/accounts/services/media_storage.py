"""Delete uploaded files from MEDIA_ROOT (Railway volume) when replaced or removed."""

from __future__ import annotations

import logging
from pathlib import PurePosixPath
from urllib.parse import unquote, urlparse

from django.conf import settings
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

_MANAGED_PREFIXES = (
    "profile_photos/",
    "kyc_uploads/",
    "jeweller_logos/",
    "jeweller_product_images/",
    "gold_rates_ad_images/",
    "gold_rates_ad_videos/",
    "personal_holding_docs/",
    "upi_proofs/",
    "settlement_receipts/",
    "cridorapay_invoices/",
)


def media_url_to_relative_path(url: str | None) -> str | None:
    """Return storage-relative path when *url* points at our MEDIA_ROOT."""
    raw = (url or "").strip()
    if not raw:
        return None

    from_http = raw.startswith("http://") or raw.startswith("https://")
    if from_http:
        path = unquote(urlparse(raw).path or "")
    else:
        path = unquote(raw)

    media_prefix = settings.MEDIA_URL if settings.MEDIA_URL.startswith("/") else f"/{settings.MEDIA_URL}"
    media_prefix = media_prefix.rstrip("/") + "/"

    if path.startswith(media_prefix):
        rel = path[len(media_prefix) :]
    elif path.startswith("/media/"):
        rel = path[len("/media/") :]
    elif from_http:
        return None
    else:
        rel = path.lstrip("/")

    rel = rel.lstrip("/")
    if not rel or ".." in PurePosixPath(rel).parts:
        return None
    return rel


def is_managed_media_path(rel_path: str) -> bool:
    return any(rel_path.startswith(prefix) for prefix in _MANAGED_PREFIXES)


def delete_media_file(rel_path: str) -> bool:
    """Delete by storage-relative path. Returns True if a managed file was removed."""
    rel = (rel_path or "").strip().lstrip("/")
    if not rel or ".." in PurePosixPath(rel).parts or not is_managed_media_path(rel):
        return False
    try:
        if default_storage.exists(rel):
            default_storage.delete(rel)
            return True
    except OSError:
        logger.warning("Failed to delete media file: %s", rel, exc_info=True)
    return False


def delete_media_by_url(url: str | None) -> bool:
    rel = media_url_to_relative_path(url)
    if not rel:
        return False
    return delete_media_file(rel)


def delete_filefield(file_field) -> bool:
    if not file_field:
        return False
    name = getattr(file_field, "name", "") or ""
    if not name:
        return False
    return delete_media_file(name)


def delete_replaced_media_url(*, old_url: str | None, new_url: str | None) -> None:
    """Remove *old_url* from storage when it differs from *new_url*."""
    old = (old_url or "").strip()
    new = (new_url or "").strip()
    if old and old != new:
        delete_media_by_url(old)
