"""User-facing labels and notes for Cridora live Kerala gold rates (no third-party names)."""

from __future__ import annotations

CRIDORA_LIVE_RATE_LABEL = "Cridora live rate"
CRIDORA_MANUAL_RATE_LABEL = "Cridora manual rate"
CRIDORA_MIXED_RATE_LABEL = "Cridora live + manual rates"
KERALA_GOLD_RATE_LABEL = "Kerala gold rate"

CRIDORA_LIVE_RATE_NOTE = (
    "Cridora live Kerala gold rate — indicative reference. "
    "Jewellers may use this rate or set their own board rates."
)
CRIDORA_LIVE_RATE_STALE_NOTE = (
    "Last stored Cridora Kerala gold rate — live feed temporarily unavailable."
)
CRIDORA_MANUAL_RATE_NOTE = (
    "Cridora manual board rate set by platform admin. "
    "Jewellers may use this rate or set their own board rates."
)

CHART_INTRADAY_NOTE = "Cridora live Kerala gold rate — sampled when published rates change."
CHART_DAILY_NOTE = (
    "Daily Kerala gold and silver close ₹/g — up to two years on record; "
    "today's row updates with the Cridora live ticker."
)

_LIVE_SOURCES = frozenset(
    {
        "akgsma_kerala",
        "kerala_gold_rate",
        "kerala_gold_rate_stale",
        "kerala_board",
        "goodreturns_kerala",
        "db_snapshot",
        "platform_floor",
        "admin_fallback",
        "live_spot",
        "stale_spot_cache",
        "spot",
    }
)


def public_rate_source_label(source: str | None) -> str:
    src = str(source or "").strip().lower()
    if src == "manual_ticker":
        return CRIDORA_MANUAL_RATE_LABEL
    if src == "mixed_ticker":
        return CRIDORA_MIXED_RATE_LABEL
    if src in _LIVE_SOURCES or not src:
        return CRIDORA_LIVE_RATE_LABEL
    return CRIDORA_LIVE_RATE_LABEL


def sanitize_public_rate_note(note: str | None, *, source: str | None = None) -> str | None:
    if note is None:
        return None
    text = str(note).strip()
    if not text:
        return None
    lowered = text.lower()
    if "unavailable" in lowered or "temporarily" in lowered or "stale" in lowered:
        return CRIDORA_LIVE_RATE_STALE_NOTE
    src = str(source or "").strip().lower()
    if src == "manual_ticker":
        return CRIDORA_MANUAL_RATE_NOTE
    if src == "mixed_ticker":
        return (
            "Cridora published rates — some metals follow the live Kerala feed, "
            "others use admin manual board rates."
        )
    blocked = (
        "jos",
        "alukkas",
        "goodreturns",
        "good returns",
        "oneindia",
        "xau",
        "xag",
        "ibja",
        "frankfurter",
        "gold-api",
        "international",
    )
    if any(token in lowered for token in blocked):
        return CRIDORA_LIVE_RATE_STALE_NOTE if "unavailable" in lowered else CRIDORA_LIVE_RATE_NOTE
    return text


def attach_public_rate_labels(payload: dict) -> dict:
    """Add source_label and sanitize note fields on public API payloads."""
    if not isinstance(payload, dict):
        return payload
    out = dict(payload)
    src = str(out.get("source") or "")
    out["source_label"] = public_rate_source_label(src)
    if "note" in out:
        out["note"] = sanitize_public_rate_note(out.get("note"), source=src)
    kb = out.get("kerala_board")
    if isinstance(kb, dict):
        kb_out = dict(kb)
        kb_src = str(kb_out.get("source") or src)
        kb_out["source_label"] = public_rate_source_label(kb_src)
        kb_out.pop("source", None)
        out["kerala_board"] = kb_out
    return out
