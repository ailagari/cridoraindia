"""Safe {{variable}} rendering for NotificationTemplate rows."""

from __future__ import annotations

import re
from dataclasses import dataclass

from apps.accounts.locale_utils import DEFAULT_PUBLIC_LOCALE, normalize_preferred_locale
from apps.accounts.models import NotificationTemplate
from apps.accounts.services.engagement_constants import (
    CONTEXT_DEFAULT,
    DEFAULT_LOCALE,
)

_VAR_PATTERN = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")
_TITLE_MAX = 180
_BODY_MAX = 2000


@dataclass(frozen=True)
class RenderedEngagementCopy:
    title: str
    body: str
    template_id: int | None
    moment: str
    context: str
    locale: str


def _substitute(template: str, facts: dict[str, str], allowed: set[str]) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in allowed:
            return match.group(0)
        return facts.get(key, "")

    return _VAR_PATTERN.sub(repl, template)


def _allowed_keys(template: NotificationTemplate | None, facts: dict[str, str]) -> set[str]:
    keys = set(facts.keys())
    if template and isinstance(template.variables, list):
        for v in template.variables:
            if isinstance(v, str) and v.strip():
                keys.add(v.strip())
    return keys


def load_template(
    *,
    moment: str,
    context: str,
    locale: str = DEFAULT_LOCALE,
) -> NotificationTemplate | None:
    loc = normalize_preferred_locale(locale) or DEFAULT_LOCALE
    row = (
        NotificationTemplate.objects.filter(
            category=moment,
            context=context,
            locale=loc,
            is_active=True,
        )
        .order_by("-updated_at")
        .first()
    )
    if row:
        return row
    if context != CONTEXT_DEFAULT:
        return (
            NotificationTemplate.objects.filter(
                category=moment,
                context=CONTEXT_DEFAULT,
                locale=loc,
                is_active=True,
            )
            .order_by("-updated_at")
            .first()
        )
    if loc != DEFAULT_PUBLIC_LOCALE:
        return load_template(moment=moment, context=CONTEXT_DEFAULT, locale=DEFAULT_PUBLIC_LOCALE)
    return None


def render_template(
    *,
    moment: str,
    context: str,
    facts: dict[str, str],
    locale: str = DEFAULT_LOCALE,
) -> RenderedEngagementCopy | None:
    row = load_template(moment=moment, context=context, locale=locale)
    if row is None:
        return None
    allowed = _allowed_keys(row, facts)
    title = _substitute(row.title_template, facts, allowed).strip()[:_TITLE_MAX]
    body = _substitute(row.body_template, facts, allowed).strip()[:_BODY_MAX]
    if not title or not body:
        return None
    return RenderedEngagementCopy(
        title=title,
        body=body,
        template_id=row.pk,
        moment=moment,
        context=context,
        locale=normalize_preferred_locale(locale) or DEFAULT_LOCALE,
    )


def preview_render(
    *,
    title_template: str,
    body_template: str,
    facts: dict[str, str],
    variables: list | None = None,
) -> dict[str, str]:
    allowed = set(facts.keys())
    if variables:
        for v in variables:
            if isinstance(v, str) and v.strip():
                allowed.add(v.strip())
    title = _substitute(title_template, facts, allowed).strip()[:_TITLE_MAX]
    body = _substitute(body_template, facts, allowed).strip()[:_BODY_MAX]
    return {
        "title": title,
        "body": body,
        "title_length": str(len(title)),
        "body_length": str(len(body)),
    }
