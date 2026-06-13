import json
import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_firebase_app = None


def fcm_configured() -> bool:
    raw = (getattr(settings, "FIREBASE_SERVICE_ACCOUNT_JSON", "") or "").strip()
    return bool(raw)


def _get_firebase_app():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    if not fcm_configured():
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        logger.warning("firebase-admin is not installed; native push delivery disabled.")
        return None
    if firebase_admin._apps:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    info = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
    cred = credentials.Certificate(info)
    _firebase_app = firebase_admin.initialize_app(cred)
    return _firebase_app


def send_fcm_payload(token: str, payload: dict[str, Any]) -> None:
    app = _get_firebase_app()
    if app is None:
        return
    from firebase_admin import messaging

    title = str(payload.get("title") or "Cridora")
    body = str(payload.get("body") or "Open Cridora for details.")
    url = str(payload.get("url") or "/")
    tag = str(payload.get("tag") or "cridora-default")
    stable_id = str(payload.get("id") or tag)
    image = str(payload.get("image") or "").strip() or None
    data_payload = {
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
        "id": stable_id,
    }
    if image:
        data_payload["image"] = image
    android_notification = messaging.AndroidNotification(
        channel_id="cridora-alerts",
        tag=tag,
    )
    if image:
        android_notification.image = image
    message = messaging.Message(
        token=token,
        notification=messaging.Notification(title=title, body=body, image=image),
        data=data_payload,
        android=messaging.AndroidConfig(
            priority="high",
            notification=android_notification,
        ),
    )
    messaging.send(message, app=app)


def send_fcm_to_user(
    user,
    payload: dict[str, Any],
    *,
    notification_id: int | None = None,
    tag: str = "",
) -> int:
    if not fcm_configured():
        return 0
    from .models import NativePushToken, PushDeliveryAttempt
    from .services.push_delivery import log_push_attempt

    n = 0
    resolved_tag = tag or str(payload.get("tag") or "")
    for row in NativePushToken.objects.filter(user=user):
        try:
            send_fcm_payload(row.token, payload)
            n += 1
            log_push_attempt(
                user=user,
                channel=PushDeliveryAttempt.CHANNEL_FCM,
                status=PushDeliveryAttempt.STATUS_SENT,
                notification_id=notification_id,
                tag=resolved_tag,
            )
        except Exception as exc:
            err = str(exc).lower()
            if "not-found" in err or "registration-token-not-registered" in err:
                row.delete()
            else:
                logger.warning(
                    "FCM delivery failed for user_id=%s platform=%s error=%s",
                    row.user_id,
                    row.platform,
                    exc,
                )
            log_push_attempt(
                user=user,
                channel=PushDeliveryAttempt.CHANNEL_FCM,
                status=PushDeliveryAttempt.STATUS_FAILED,
                notification_id=notification_id,
                tag=resolved_tag,
                error_message=str(exc)[:255],
            )
    return n


def send_fcm_broadcast(payload: dict[str, Any]) -> int:
    from .locale_utils import DEFAULT_PUBLIC_LOCALE

    return send_fcm_broadcast_localized({DEFAULT_PUBLIC_LOCALE: payload})


def send_fcm_broadcast_localized(payloads_by_locale: dict[str, dict[str, Any]]) -> int:
    if not fcm_configured() or not payloads_by_locale:
        return 0
    from .models import NativePushToken
    from .locale_utils import DEFAULT_PUBLIC_LOCALE, normalize_preferred_locale

    default_payload = payloads_by_locale.get(DEFAULT_PUBLIC_LOCALE) or next(iter(payloads_by_locale.values()))
    n = 0
    for row in NativePushToken.objects.all().iterator(chunk_size=200):
        loc = normalize_preferred_locale(row.preferred_locale)
        payload = payloads_by_locale.get(loc) or default_payload
        try:
            send_fcm_payload(row.token, payload)
            n += 1
        except Exception as exc:
            err = str(exc).lower()
            if "not-found" in err or "registration-token-not-registered" in err:
                row.delete()
            else:
                logger.warning(
                    "FCM broadcast failed for user_id=%s platform=%s error=%s",
                    row.user_id,
                    row.platform,
                    exc,
                )
    return n
