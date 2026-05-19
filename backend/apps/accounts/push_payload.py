"""Shared push notification payload helpers."""

from __future__ import annotations

from django.conf import settings


def resolve_push_image_url(raw: str | None) -> str | None:
    """Return an absolute HTTPS URL suitable for Web Push / FCM image fields."""
    if not raw:
        return None
    url = str(raw).strip()
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    base = (getattr(settings, "DJANGO_PUBLIC_BASE_URL", "") or "").strip().rstrip("/")
    if not base:
        return None
    if not url.startswith("/"):
        url = f"/{url}"
    return f"{base}{url}"


def build_push_payload(
    *,
    title: str,
    body: str,
    url: str,
    tag: str,
    image_url: str | None = None,
) -> dict:
    payload: dict = {
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
    }
    image = resolve_push_image_url(image_url)
    if image:
        payload["image"] = image
    return payload
