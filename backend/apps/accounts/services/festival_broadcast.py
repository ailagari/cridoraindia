"""Process scheduled festival / broadcast Web Push notifications."""

import logging
import re

from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from django.contrib.auth import get_user_model

from apps.accounts.models import AdminNotification, FestivalBroadcastNotification, WebPushSubscription
from apps.accounts.models import PortfolioUserNotification
from apps.accounts.push_payload import build_push_payload
from apps.accounts.services.campaign_audience import resolve_campaign_user_ids
from apps.accounts.services.deliver_engagement import deliver_engagement
from apps.accounts.services.engagement_context import EngagementContextResult
from apps.accounts.services.engagement_facts import build_engagement_facts
from apps.accounts.services.engagement_template_render import render_template
from apps.accounts.services.notification_preferences import get_or_create_preferences, should_send_push
from apps.accounts.services.notification_rate_limits import (
    promotional_allowed_for_jeweller,
    record_promotional_jeweller,
)
from apps.accounts.webpush_service import send_push_broadcast, send_push_to_user

User = get_user_model()

logger = logging.getLogger(__name__)

MAX_RETAINED_FESTIVAL_SCHEDULES = 3
MAX_RETAINED_FESTIVAL_FEED_ROWS = 3

_ZERO_DEVICE_SUFFIX = "Sent to 0 devices — check VAPID env vars and user subscriptions."
_SENT_COUNT_SUFFIX_RE = re.compile(r"(?:\r?\n){2}Sent to \d+ subscribed device\(s\)\.\s*\Z")


def _campaign_engagement_context(row: FestivalBroadcastNotification) -> EngagementContextResult:
    ctx = (row.engagement_context or "").strip() or "default"
    return EngagementContextResult(
        context=ctx,
        festival_name=(row.festival_name or "").strip(),
        festival_message=(row.festival_message or "").strip(),
    )


def _payload_for_user(row: FestivalBroadcastNotification, user: User) -> dict | None:
    moment = (row.engagement_moment or "").strip()
    if row.personalize_per_user and moment:
        ctx = _campaign_engagement_context(row)
        facts = build_engagement_facts(user, context=ctx)
        rendered = render_template(moment=moment, context=ctx.context, facts=facts)
        if rendered:
            title, body = rendered.title, rendered.body
        else:
            title = row.title.strip() or "Cridora"
            body = row.body.strip()
    else:
        title = row.title.strip() or "Cridora"
        body = row.body.strip()
    if not body:
        return None
    return build_push_payload(
        title=title[:120],
        body=body,
        url="/",
        tag=f"cridora-festival-{row.pk}",
        image_url=(row.image_url or "").strip() or (row.logo_url or "").strip() or None,
    )


def _deliver_campaign_push(row: FestivalBroadcastNotification, payload: dict) -> int:
    jeweller_id = None
    if row.created_by_jeweller_id:
        jeweller_id = row.created_by_jeweller_id
    if not promotional_allowed_for_jeweller(jeweller_id):
        return 0

    if row.target_type == FestivalBroadcastNotification.TARGET_ALL_APP_INSTALLS:
        if row.personalize_per_user and (row.engagement_moment or "").strip():
            total = 0
            for uid in resolve_campaign_user_ids(row.target_type, row.target_metadata):
                user = User.objects.filter(pk=uid, is_active=True).first()
                if user is None:
                    continue
                pref = get_or_create_preferences(user)
                if not pref.allow_festival_alerts and not pref.allow_promotional:
                    continue
                pl = _payload_for_user(row, user)
                if pl and should_send_push(user, category="promo", priority="low"):
                    total += send_push_to_user(user, pl)
                    if row.store_in_inbox:
                        _store_campaign_inbox(row, user, pl)
            if jeweller_id:
                record_promotional_jeweller(jeweller_id)
            return total
        return send_push_broadcast(payload)

    total = 0
    for uid in resolve_campaign_user_ids(row.target_type, row.target_metadata):
        user = User.objects.filter(pk=uid, is_active=True).first()
        if user is None:
            continue
        pref = get_or_create_preferences(user)
        if not pref.allow_festival_alerts and not pref.allow_promotional:
            continue
        pl = _payload_for_user(row, user) if row.personalize_per_user else payload
        if pl and should_send_push(user, category="promo", priority="low"):
            total += send_push_to_user(user, pl)
            if row.store_in_inbox:
                _store_campaign_inbox(row, user, pl)
    if jeweller_id and total:
        record_promotional_jeweller(jeweller_id)
    return total


def _store_campaign_inbox(row: FestivalBroadcastNotification, user: User, payload: dict) -> None:
    moment = (row.engagement_moment or "").strip()
    if moment and row.personalize_per_user:
        deliver_engagement(
            user,
            moment=moment,
            context=_campaign_engagement_context(row),
            link_path="/",
            category=PortfolioUserNotification.CATEGORY_PROMO,
            priority=PortfolioUserNotification.PRIORITY_LOW,
            notification_type="festival_campaign",
            image_url=payload.get("image"),
            tag=f"cridora-festival-inbox-{row.pk}",
            send_push=False,
        )
        return
    from apps.accounts.services.inbox_notify import notify_inbox

    notify_inbox(
        user,
        kind=PortfolioUserNotification.KIND_SYSTEM,
        title=(payload.get("title") or "Cridora")[:180],
        body=payload.get("body") or "",
        link_path="/",
        category=PortfolioUserNotification.CATEGORY_PROMO,
        priority=PortfolioUserNotification.PRIORITY_LOW,
        notification_type="festival_campaign",
        image_url=payload.get("image"),
        tag=f"cridora-festival-inbox-{row.pk}",
        send_push=False,
        jeweller_id=row.created_by_jeweller_id,
    )


def strip_festival_broadcast_feed_body(text: str) -> str:
    """Remove internal delivery stats appended to older in-app festival receipts."""
    if not text:
        return ""
    s = text.rstrip()
    if s.endswith(_ZERO_DEVICE_SUFFIX):
        s = s[: -len(_ZERO_DEVICE_SUFFIX)].rstrip()
    s = _SENT_COUNT_SUFFIX_RE.sub("", s)
    return s.rstrip()


def prune_festival_broadcast_feed_notifications(*, max_rows: int = MAX_RETAINED_FESTIVAL_FEED_ROWS) -> int:
    """Keep only the newest ``max_rows`` in-app festival receipts; return deleted row count."""
    base = AdminNotification.objects.filter(kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT).order_by(
        "-created_at", "-id"
    )
    keep_ids = list(base.values_list("pk", flat=True)[:max_rows])
    remove = AdminNotification.objects.filter(kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT)
    if keep_ids:
        remove = remove.exclude(pk__in=keep_ids)
    deleted, _ = remove.delete()
    return deleted


def prune_festival_completed_schedules(*, max_rows: int = MAX_RETAINED_FESTIVAL_SCHEDULES) -> int:
    """
    Keep only the newest ``max_rows`` completed festival schedule rows (sent / failed / cancelled).
    Pending schedules are never deleted.
    """
    terminal = (
        FestivalBroadcastNotification.STATUS_SENT,
        FestivalBroadcastNotification.STATUS_FAILED,
        FestivalBroadcastNotification.STATUS_CANCELLED,
    )
    completed = FestivalBroadcastNotification.objects.filter(status__in=terminal).order_by(
        "-created_at", "-id"
    )
    keep_ids = list(completed.values_list("pk", flat=True)[:max_rows])
    remove = FestivalBroadcastNotification.objects.filter(status__in=terminal)
    if keep_ids:
        remove = remove.exclude(pk__in=keep_ids)
    deleted, _ = remove.delete()
    return deleted


def prune_festival_broadcast_history() -> tuple[int, int]:
    """Trim stored festival schedule history and in-app feed rows to policy limits."""
    n_sched = prune_festival_completed_schedules()
    n_feed = prune_festival_broadcast_feed_notifications()
    if n_sched or n_feed:
        logger.info(
            "festival_broadcast retention pruned schedules=%s feed_notifications=%s",
            n_sched,
            n_feed,
        )
    return n_sched, n_feed


def process_due_festival_broadcasts(*, limit: int = 50) -> int:
    """
    Deliver all pending rows whose scheduled_at is in the past or now.

    Uses row-level locking to avoid duplicate sends when multiple workers run.
    Returns how many rows were finalized (sent, failed, or skipped after lock contention).
    """
    now = timezone.now()
    finalized = 0
    for _ in range(limit):
        with transaction.atomic():
            row = (
                FestivalBroadcastNotification.objects.select_for_update(skip_locked=True)
                .filter(
                    status=FestivalBroadcastNotification.STATUS_PENDING,
                    scheduled_at__lte=now,
                )
                .order_by("scheduled_at", "id")
                .first()
            )
            if row is None:
                break
            try:
                try:
                    sub_total = WebPushSubscription.objects.count()
                    by_role = {
                        r["user__user_type"]: r["c"]
                        for r in WebPushSubscription.objects.values("user__user_type").annotate(
                            c=Count("id")
                        )
                    }
                    logger.info(
                        "festival_broadcast id=%s sending web_push to all subscriptions total=%s by_user_type=%s",
                        row.pk,
                        sub_total,
                        by_role,
                    )
                except Exception:
                    logger.exception(
                        "festival_broadcast id=%s subscription stats log failed; continuing send",
                        row.pk,
                    )
                payload = build_push_payload(
                    title=row.title.strip() or "Cridora",
                    body=row.body.strip(),
                    url="/",
                    tag=f"cridora-festival-{row.pk}",
                    image_url=(row.image_url or "").strip() or (row.logo_url or "").strip() or None,
                )
                n = _deliver_campaign_push(row, payload)
                row.status = FestivalBroadcastNotification.STATUS_SENT
                row.sent_at = now
                row.push_recipient_count = n
                row.save(
                    update_fields=[
                        "status",
                        "sent_at",
                        "push_recipient_count",
                    ]
                )
                preview = row.body.strip()
                if len(preview) > 400:
                    preview = preview[:397] + "…"
                AdminNotification.objects.create(
                    kind=AdminNotification.KIND_FESTIVAL_BROADCAST_SENT,
                    title=row.title.strip() or "Festival broadcast sent",
                    body=preview,
                    link_path="/",
                    actor=row.created_by,
                )
            except Exception as exc:
                row.status = FestivalBroadcastNotification.STATUS_FAILED
                row.error_message = str(exc)[:2000]
                row.save(update_fields=["status", "error_message"])
        finalized += 1
    prune_festival_broadcast_history()
    return finalized
