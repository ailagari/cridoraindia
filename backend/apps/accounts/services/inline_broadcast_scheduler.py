"""Background loop inside the main web process (Gunicorn) for due scheduled pushes."""

from __future__ import annotations

import logging
import os
import sys
import threading
import time

logger = logging.getLogger(__name__)

ADVISORY_LOCK_ID = 87_342_101
INTERVAL_SECONDS = 60
_started = False


def _enabled() -> bool:
    return os.environ.get("INLINE_BROADCAST_SCHEDULER", "").lower() in (
        "1",
        "true",
        "yes",
    )


def _should_start() -> bool:
    if not _enabled():
        return False
    skip = {
        "test",
        "migrate",
        "makemigrations",
        "shell",
        "collectstatic",
        "process_festival_broadcasts",
        "trigger_scheduled_broadcasts_http",
        "ensure_media_root",
    }
    if any(arg in sys.argv for arg in skip):
        return False
    if "runserver" in sys.argv:
        return os.environ.get("RUN_MAIN") == "true"
    return True


def _try_pg_advisory_lock() -> bool:
    from django.db import connection

    if connection.vendor != "postgresql":
        return True
    with connection.cursor() as cur:
        cur.execute("SELECT pg_try_advisory_lock(%s)", [ADVISORY_LOCK_ID])
        row = cur.fetchone()
    return bool(row and row[0])


def _release_pg_advisory_lock() -> None:
    from django.db import connection

    if connection.vendor != "postgresql":
        return
    with connection.cursor() as cur:
        cur.execute("SELECT pg_advisory_unlock(%s)", [ADVISORY_LOCK_ID])


def _loop() -> None:
    time.sleep(20)
    from .festival_broadcast_scheduler import maybe_process_scheduled_broadcasts

    while True:
        try:
            if _try_pg_advisory_lock():
                try:
                    n = maybe_process_scheduled_broadcasts(force=True)
                    if n:
                        logger.info("inline scheduler finalized %s broadcast row(s)", n)
                finally:
                    _release_pg_advisory_lock()
        except Exception:
            logger.exception("inline broadcast scheduler tick failed")
        time.sleep(INTERVAL_SECONDS)


def start_inline_broadcast_scheduler() -> None:
    global _started
    if _started or not _should_start():
        return
    _started = True
    thread = threading.Thread(
        target=_loop,
        name="cridora-broadcast-scheduler",
        daemon=True,
    )
    thread.start()
    logger.info("inline broadcast scheduler started (interval=%ss)", INTERVAL_SECONDS)
