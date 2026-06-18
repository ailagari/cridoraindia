"""In-app paths opened when a push notification is tapped."""

from __future__ import annotations

from apps.accounts.push_payload import build_push_payload


def normalize_in_app_path(raw: str | None, *, default: str = "/") -> str:
    path = (raw or "").strip()
    if not path:
        return default
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if not path.startswith("/"):
        path = f"/{path}"
    return path


def resolve_tap_paths(
    *,
    fallback: str,
    guest: str | None = None,
    authenticated: str | None = None,
) -> tuple[str, str, str]:
    """Return (url_guest, url_authenticated, url_fallback)."""
    fb = normalize_in_app_path(fallback, default="/")
    url_guest = normalize_in_app_path(guest, default=fb) if guest else fb
    url_auth = normalize_in_app_path(authenticated, default=fb) if authenticated else fb
    return url_guest, url_auth, fb


def build_tap_push_payload(
    *,
    title: str,
    body: str,
    tag: str,
    fallback_url: str,
    url_guest: str | None = None,
    url_authenticated: str | None = None,
    image_url: str | None = None,
    notification_id: str | None = None,
    for_authenticated_user: bool | None = None,
) -> dict:
    """
    Build a push payload with guest vs signed-in tap targets.

    When ``for_authenticated_user`` is True/False, ``url`` is resolved for that
    recipient (per-user sends). When None, ``url`` is the guest fallback and
    clients pick ``url_authenticated`` on tap for signed-in users.
    """
    guest, auth, fb = resolve_tap_paths(
        fallback=fallback_url,
        guest=url_guest,
        authenticated=url_authenticated,
    )
    if for_authenticated_user is True:
        primary = auth
    elif for_authenticated_user is False:
        primary = guest
    else:
        primary = fb
    payload = build_push_payload(
        title=title,
        body=body,
        url=primary,
        tag=tag,
        image_url=image_url,
        notification_id=notification_id,
    )
    if guest != auth:
        payload["url_guest"] = guest
        payload["url_authenticated"] = auth
    elif guest != primary:
        payload["url_guest"] = guest
        payload["url_authenticated"] = auth
    return payload
