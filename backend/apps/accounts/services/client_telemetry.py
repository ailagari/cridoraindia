"""Client device heartbeat and PWA install analytics."""

from __future__ import annotations

from django.db.models import Count, Q
from django.utils import timezone

from apps.accounts.models import ClientDeviceSession, NativePushToken, WebPushSubscription


def upsert_client_heartbeat(
    *,
    client_id: str,
    surface: str,
    push_permission: str,
    push_registered: bool,
    user_id: int | None,
    user_agent: str,
    preferred_locale: str,
) -> ClientDeviceSession:
    valid_surfaces = {c[0] for c in ClientDeviceSession.SURFACE_CHOICES}
    valid_perms = {c[0] for c in ClientDeviceSession.PUSH_PERMISSION_CHOICES}
    surf = surface if surface in valid_surfaces else ClientDeviceSession.SURFACE_BROWSER
    perm = push_permission if push_permission in valid_perms else ClientDeviceSession.PERM_DEFAULT
    row, _ = ClientDeviceSession.objects.update_or_create(
        client_id=client_id,
        defaults={
            "user_id": user_id,
            "surface": surf,
            "push_permission": perm,
            "push_registered": bool(push_registered),
            "user_agent": (user_agent or "")[:512],
            "preferred_locale": (preferred_locale or "en")[:8],
            "last_seen_at": timezone.now(),
        },
    )
    return row


def mark_pwa_installed(client_id: str, user_id: int | None = None) -> ClientDeviceSession | None:
    row = ClientDeviceSession.objects.filter(client_id=client_id).first()
    if not row:
        row = ClientDeviceSession.objects.create(
            client_id=client_id,
            user_id=user_id,
            surface=ClientDeviceSession.SURFACE_PWA,
            pwa_installed_at=timezone.now(),
        )
        return row
    updates = {
        "surface": ClientDeviceSession.SURFACE_PWA,
        "pwa_installed_at": row.pwa_installed_at or timezone.now(),
    }
    if user_id and not row.user_id:
        updates["user_id"] = user_id
    for k, v in updates.items():
        setattr(row, k, v)
    row.save(update_fields=list(updates.keys()) + ["last_seen_at"])
    return row


def client_surface_stats_payload() -> dict:
    now = timezone.now()
    week_ago = now - timezone.timedelta(days=7)

    sessions = ClientDeviceSession.objects.all()
    active_week = sessions.filter(last_seen_at__gte=week_ago)

    pwa_installed = sessions.filter(pwa_installed_at__isnull=False).count()
    pwa_active = active_week.filter(surface=ClientDeviceSession.SURFACE_PWA).count()
    browser_active = active_week.filter(surface=ClientDeviceSession.SURFACE_BROWSER).count()
    push_enabled_sessions = sessions.filter(
        Q(push_registered=True) | Q(push_permission=ClientDeviceSession.PERM_GRANTED)
    ).count()

    web_push = WebPushSubscription.objects.count()
    native_fcm = NativePushToken.objects.count()

    by_surface = (
        sessions.values("surface")
        .annotate(c=Count("id"))
        .order_by("-c")
    )

    return {
        "pwa_installations_total": pwa_installed,
        "browser_activations_7d": browser_active,
        "pwa_activations_7d": pwa_active,
        "push_enabled_sessions": push_enabled_sessions,
        "web_push_subscriptions": web_push,
        "native_push_tokens": native_fcm,
        "total_push_devices": web_push + native_fcm,
        "sessions_total": sessions.count(),
        "sessions_active_7d": active_week.count(),
        "by_surface": list(by_surface),
    }
