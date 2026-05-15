import json
import logging
from typing import Any

from django.conf import settings
from django.db.models import Q
from pywebpush import WebPushException, webpush

from .models import WebPushSubscription

logger = logging.getLogger(__name__)

# FCM/APNs: ttl=0 tends to mean deliver-immediately-or-drop; non-zero TTL improves delivery when the device is briefly offline.
_WEB_PUSH_TTL_SECONDS = 86_400


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
        ttl=_WEB_PUSH_TTL_SECONDS,
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
            else:
                logger.warning(
                    "Web Push delivery failed for user_id=%s endpoint_prefix=%s status=%s error=%s",
                    sub.user_id,
                    (sub.endpoint[:64] + "…") if len(sub.endpoint) > 64 else sub.endpoint,
                    status,
                    exc,
                )
    return n


def send_push_broadcast(payload: dict[str, Any]) -> int:
    """Send to every stored Push subscription row (no filter by user role).

    Covers customer, jeweller, and admin accounts equally — anyone who tapped Enable
    and has a row in ``WebPushSubscription``. Each browser/profile yields at most one
    subscription (extra tabs do not create separate endpoints).
    """
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
            else:
                logger.warning(
                    "Web Push broadcast failed for user_id=%s endpoint_prefix=%s status=%s error=%s",
                    sub.user_id,
                    (sub.endpoint[:64] + "…") if len(sub.endpoint) > 64 else sub.endpoint,
                    status,
                    exc,
                )
        except Exception as exc:
            logger.warning(
                "Web Push broadcast unexpected error for user_id=%s endpoint_prefix=%s error=%s",
                sub.user_id,
                (sub.endpoint[:64] + "…") if len(sub.endpoint) > 64 else sub.endpoint,
                exc,
            )
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
