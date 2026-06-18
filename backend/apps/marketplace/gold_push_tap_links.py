"""Gold ticker tap link helpers for automated push alerts."""

from __future__ import annotations

from apps.accounts.push_tap_links import resolve_tap_paths

from .models import GoldTickerConfig


def hourly_gold_tap_paths(ticker: GoldTickerConfig) -> tuple[str, str, str]:
    fallback = (ticker.hourly_gold_push_link or "/marketplace").strip() or "/marketplace"
    return resolve_tap_paths(
        fallback=fallback,
        guest=(ticker.hourly_gold_push_link_guest or "").strip() or None,
        authenticated=(ticker.hourly_gold_push_link_authenticated or "").strip() or None,
    )


def rate_move_tap_paths(ticker: GoldTickerConfig) -> tuple[str, str, str]:
    fallback = (ticker.rate_move_alert_link or "/marketplace").strip() or "/marketplace"
    return resolve_tap_paths(
        fallback=fallback,
        guest=(ticker.rate_move_alert_link_guest or "").strip() or None,
        authenticated=(ticker.rate_move_alert_link_authenticated or "").strip() or None,
    )
