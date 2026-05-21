"""Public-site locale helpers (English / Malayalam)."""

from __future__ import annotations

DEFAULT_PUBLIC_LOCALE = "en"
SUPPORTED_PUBLIC_LOCALES = frozenset({"en", "ml"})


def normalize_preferred_locale(raw: str | None) -> str:
    """Map request/storage values to a supported public locale; default English."""
    if not raw:
        return DEFAULT_PUBLIC_LOCALE
    value = str(raw).strip().lower()
    if value.startswith("ml"):
        return "ml"
    return DEFAULT_PUBLIC_LOCALE
