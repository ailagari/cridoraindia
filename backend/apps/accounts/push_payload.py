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


def truncate_push_copy(title: str, body: str) -> tuple[str, str]:
    """Spec limits: title 45 chars, body 120 chars."""
    t = (title or "").strip()
    b = (body or "").strip()
    if len(t) > 45:
        t = t[:42] + "..."
    if len(b) > 120:
        b = b[:117] + "..."
    return t, b


def build_push_payload(
    *,
    title: str,
    body: str,
    url: str,
    tag: str,
    image_url: str | None = None,
    notification_id: str | None = None,
) -> dict:
    title, body = truncate_push_copy(title, body)
    payload: dict = {
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
        "id": notification_id or tag,
    }
    image = resolve_push_image_url(image_url)
    if image:
        payload["image"] = image
    return payload
