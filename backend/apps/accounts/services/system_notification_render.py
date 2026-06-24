"""Resolve admin-editable system notification copy with optional text rotation."""

from __future__ import annotations

import random
from dataclasses import dataclass

from apps.accounts.locale_utils import DEFAULT_PUBLIC_LOCALE, normalize_preferred_locale
from apps.accounts.services.engagement_template_render import preview_render
from apps.accounts.services.system_notification_catalog import catalog_entry


@dataclass(frozen=True)
class ResolvedSystemCopy:
    title: str
    body: str
    key: str
    locale: str
    message_id: int | None = None


def _pick_variant(primary: str, alternatives: list) -> str:
    choices = [primary] if primary else []
    for alt in alternatives:
        if isinstance(alt, str) and alt.strip():
            choices.append(alt.strip())
    if not choices:
        return ""
    return random.choice(choices)


def _load_row(key: str, locale: str):
    from apps.accounts.models import SystemNotificationMessage

    loc = normalize_preferred_locale(locale) or DEFAULT_PUBLIC_LOCALE
    row = (
        SystemNotificationMessage.objects.filter(key=key, locale=loc, is_active=True)
        .order_by("-updated_at")
        .first()
    )
    if row:
        return row
    if loc != DEFAULT_PUBLIC_LOCALE:
        return (
            SystemNotificationMessage.objects.filter(
                key=key, locale=DEFAULT_PUBLIC_LOCALE, is_active=True
            )
            .order_by("-updated_at")
            .first()
        )
    return None


def resolve_system_notification(
    key: str,
    *,
    locale: str = DEFAULT_PUBLIC_LOCALE,
    facts: dict[str, str] | None = None,
) -> ResolvedSystemCopy:
    """
    Load copy for a system notification key. Picks a random title/body variant when
    alternatives are configured. Falls back to catalog defaults.
    """
    facts = {str(k): str(v) for k, v in (facts or {}).items()}
    loc = normalize_preferred_locale(locale) or DEFAULT_PUBLIC_LOCALE

    row = _load_row(key, loc)
    catalog = catalog_entry(key, loc)

    title_template = ""
    body_template = ""
    alt_titles: list = []
    alt_bodies: list = []
    variables: list = []
    message_id = None

    if row:
        message_id = row.pk
        title_template = (row.title_template or "").strip()
        body_template = (row.body_template or "").strip()
        alt_titles = row.alternative_titles if isinstance(row.alternative_titles, list) else []
        alt_bodies = row.alternative_bodies if isinstance(row.alternative_bodies, list) else []
        variables = row.variables if isinstance(row.variables, list) else []

    if catalog:
        if not title_template:
            title_template = catalog["title_template"]
        if not body_template:
            body_template = catalog["body_template"]
        if not variables:
            variables = catalog["variables"]

    title_raw = _pick_variant(title_template, alt_titles)
    body_raw = _pick_variant(body_template, alt_bodies)

    rendered = preview_render(
        title_template=title_raw,
        body_template=body_raw,
        facts=facts,
        variables=variables,
    )
    return ResolvedSystemCopy(
        title=rendered["title"],
        body=rendered["body"],
        key=key,
        locale=loc,
        message_id=message_id,
    )
