import json
from typing import Any

from django.conf import settings
from django.db.models import Q
from pywebpush import WebPushException, webpush

from .models import WebPushSubscription


def webpush_configured() -> bool:
    pub = (getattr(settings, "WEB_PUSH_VAPID_PUBLIC_KEY", "") or "").strip()
    priv = (getattr(settings, "WEB_PUSH_VAPID_PRIVATE_KEY", "") or "").strip()
    return bool(pub and priv)


def send_push_payload(subscription: WebPushSubscription, payload: dict[str, Any]) -> None:
    if not webpush_configured():
        return
    private_key = settings.WEB_PUSH_VAPID_PRIVATE_KEY.strip().replace("\\n", "\n")
    info = {
        "endpoint": subscription.endpoint,
        "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
    }
    webpush(
        subscription_info=info,
        data=json.dumps(payload),
        vapid_private_key=private_key,
        vapid_claims={"sub": settings.WEB_PUSH_VAPID_CONTACT.strip()},
    )


def send_push_to_user(user, payload: dict[str, Any]) -> int:
    """Send payload to all stored subscriptions; drop endpoints that return 410."""
    if not webpush_configured():
        return 0
    n = 0
    for sub in WebPushSubscription.objects.filter(user=user):
        try:
            send_push_payload(sub, payload)
            n += 1
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status == 410:
                sub.delete()
    return n


def send_push_broadcast(payload: dict[str, Any]) -> int:
    """Send to every stored device subscription (e.g. gold rate alerts)."""
    if not webpush_configured():
        return 0
    n = 0
    for sub in WebPushSubscription.objects.all().iterator(chunk_size=200):
        try:
            send_push_payload(sub, payload)
            n += 1
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status == 410:
                sub.delete()
    return n


def send_push_to_platform_admins(payload: dict[str, Any]) -> int:
    """Notify platform admins only (JWT/browser admins + Django staff superusers)."""
    from django.contrib.auth import get_user_model

    AdminUser = get_user_model()
    if not webpush_configured():
        return 0
    admins = AdminUser.objects.filter(
        Q(user_type=AdminUser.ADMIN) | Q(is_superuser=True, is_staff=True)
    ).distinct()
    total = 0
    for admin_user in admins.iterator(chunk_size=100):
        total += send_push_to_user(admin_user, payload)
    return total
