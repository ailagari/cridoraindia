"""Throttled runner for due scheduled festival / broadcast pushes."""

import logging

from django.core.cache import cache

from .festival_broadcast import process_due_festival_broadcasts

logger = logging.getLogger(__name__)

THROTTLE_SECONDS = 240
CACHE_KEY = "cridora:festival_broadcast_processor"


def maybe_process_scheduled_broadcasts(*, force: bool = False) -> int:
    """
    Process due scheduled broadcasts.

    When ``force`` is false, at most one run per worker every ~4 minutes (cache throttle).
    Row-level DB locking still prevents duplicate sends if multiple workers run.
    """
    if not force and cache.get(CACHE_KEY):
        return 0
    if not force:
        cache.set(CACHE_KEY, 1, THROTTLE_SECONDS)
    try:
        n = process_due_festival_broadcasts()
        if n:
            logger.info("processed %s scheduled broadcast row(s)", n)
        return n
    except Exception:
        if not force:
            cache.delete(CACHE_KEY)
        raise
