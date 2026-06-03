import json
import logging
from typing import Any

from django.conf import settings
from django.db.models import Q
from pywebpush import WebPushException, webpush

from .models import PushDeliveryAttempt, WebPushSubscription
from .locale_utils import DEFAULT_PUBLIC_LOCALE, normalize_preferred_locale
from .vapid_utils import load_vapid_private_key, vapid_signer_ready
from . import fcm_service

logger = logging.getLogger(__name__)

# FCM/APNs: ttl=0 tends to mean deliver-immediately-or-drop; non-zero TTL improves delivery when the device is briefly offline.
_WEB_PUSH_TTL_SECONDS = 86_400


def _notification_id_from_payload(payload: dict[str, Any]) -> int | None:
    raw = payload.get("id")
    if raw is None:
        return None
    try:
        return int(str(raw))
    except (TypeError, ValueError):
        return None


def webpush_configured() -> bool:
    pub = (getattr(settings, "WEB_PUSH_VAPID_PUBLIC_KEY", "") or "").strip()
    priv = (getattr(settings, "WEB_PUSH_VAPID_PRIVATE_KEY", "") or "").strip()
    return bool(pub and priv and vapid_signer_ready(pub, priv))


def push_delivery_configured() -> bool:
    """True when at least one push channel (Web Push or FCM) can send."""
    return webpush_configured() or fcm_service.fcm_configured()


def _vapid_signer():
    return load_vapid_private_key((settings.WEB_PUSH_VAPID_PRIVATE_KEY or "").strip())


def send_push_payload(subscription: WebPushSubscription, payload: dict[str, Any]) -> None:
    if not webpush_configured():
        return
    info = {
        "endpoint": subscription.endpoint,
        "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
    }
    webpush(
        subscription_info=info,
        data=json.dumps(payload),
        vapid_private_key=_vapid_signer(),
        vapid_claims={"sub": settings.WEB_PUSH_VAPID_CONTACT.strip()},
        ttl=_WEB_PUSH_TTL_SECONDS,
    )


def send_push_to_user(user, payload: dict[str, Any]) -> int:
    """Send payload to all stored subscriptions; drop endpoints that return 410."""
    from .services.push_delivery import log_push_attempt

    n = 0
    nid = _notification_id_from_payload(payload)
    tag = str(payload.get("tag") or "")
    if webpush_configured():
        for sub in WebPushSubscription.objects.filter(user=user):
            try:
                send_push_payload(sub, payload)
                n += 1
                log_push_attempt(
                    user=user,
                    channel=PushDeliveryAttempt.CHANNEL_WEBPUSH,
                    status=PushDeliveryAttempt.STATUS_SENT,
                    notification_id=nid,
                    tag=tag,
                )
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
                log_push_attempt(
                    user=user,
                    channel=PushDeliveryAttempt.CHANNEL_WEBPUSH,
                    status=PushDeliveryAttempt.STATUS_FAILED,
                    notification_id=nid,
                    tag=tag,
                    error_message=str(status or exc)[:255],
                )
            except Exception as exc:
                logger.warning(
                    "Web Push delivery unexpected error for user_id=%s endpoint_prefix=%s error=%s",
                    sub.user_id,
                    (sub.endpoint[:64] + "…") if len(sub.endpoint) > 64 else sub.endpoint,
                    exc,
                )
                log_push_attempt(
                    user=user,
                    channel=PushDeliveryAttempt.CHANNEL_WEBPUSH,
                    status=PushDeliveryAttempt.STATUS_FAILED,
                    notification_id=nid,
                    tag=tag,
                    error_message=str(exc)[:255],
                )
    n += fcm_service.send_fcm_to_user(user, payload, notification_id=nid, tag=tag)
    return n


def send_push_to_users(users, payload: dict[str, Any]) -> int:
    """Send to each user's devices only (Web Push + FCM)."""
    total = 0
    for user in users.iterator(chunk_size=100):
        total += send_push_to_user(user, payload)
    return total


def send_push_broadcast(payload: dict[str, Any]) -> int:
    """Broadcast to all push subscribers (customers, jewellers, guests who enabled alerts).

    Use for public market gold-rate alerts, hourly price digests, and admin festival announcements.
    Not for OTP, deposits, loans, or portfolio-specific activity — use ``send_push_to_user`` instead.
    """
    return send_push_broadcast_localized({DEFAULT_PUBLIC_LOCALE: payload})


def send_push_broadcast_localized(payloads_by_locale: dict[str, dict[str, Any]]) -> int:
    """Broadcast locale-specific payloads (public gold alerts). Falls back to English."""
    if not payloads_by_locale:
        return 0
    default_payload = payloads_by_locale.get(DEFAULT_PUBLIC_LOCALE) or next(iter(payloads_by_locale.values()))
    n = 0
    if webpush_configured():
        for sub in WebPushSubscription.objects.all().iterator(chunk_size=200):
            loc = normalize_preferred_locale(sub.preferred_locale)
            payload = payloads_by_locale.get(loc) or default_payload
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
    n += fcm_service.send_fcm_broadcast_localized(payloads_by_locale)
    return n


def send_push_to_platform_admins(payload: dict[str, Any]) -> int:
    """Notify platform admins only (JWT/browser admins + Django staff superusers)."""
    from django.contrib.auth import get_user_model

    AdminUser = get_user_model()
    if not push_delivery_configured():
        return 0
    admins = AdminUser.objects.filter(
        Q(user_type=AdminUser.ADMIN) | Q(is_superuser=True, is_staff=True)
    ).distinct()
    total = 0
    for admin_user in admins.iterator(chunk_size=100):
        total += send_push_to_user(admin_user, payload)
    return total
