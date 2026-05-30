"""In-process push delivery queue flushed after GoldPriceUpdated pipeline runs."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

_queue: list[Callable[[], None]] = []


def reset_push_queue() -> None:
    _queue.clear()


def enqueue_push_delivery(fn: Callable[[], None]) -> None:
    _queue.append(fn)


def flush_push_queue() -> int:
    n = 0
    pending = list(_queue)
    _queue.clear()
    for fn in pending:
        fn()
        n += 1
    return n


def queue_len() -> int:
    return len(_queue)
