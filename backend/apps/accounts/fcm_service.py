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
    message = messaging.Message(
        token=token,
        notification=messaging.Notification(title=title, body=body),
        data={"url": url, "tag": tag},
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id="cridora-alerts",
                tag=tag,
            ),
        ),
    )
    messaging.send(message, app=app)


def send_fcm_to_user(user, payload: dict[str, Any]) -> int:
    if not fcm_configured():
        return 0
    from .models import NativePushToken

    n = 0
    for row in NativePushToken.objects.filter(user=user):
        try:
            send_fcm_payload(row.token, payload)
            n += 1
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
    return n


def send_fcm_broadcast(payload: dict[str, Any]) -> int:
    if not fcm_configured():
        return 0
    from .models import NativePushToken

    n = 0
    for row in NativePushToken.objects.all().iterator(chunk_size=200):
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
