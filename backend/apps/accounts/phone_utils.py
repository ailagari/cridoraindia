"""India mobile normalization for OTP and signup."""

from __future__ import annotations

import re


def normalize_in_phone(raw: str) -> str | None:
    d = re.sub(r"\D+", "", raw or "")
    if len(d) == 10:
        return "91" + d
    if len(d) == 12 and d.startswith("91"):
        return d
    if len(d) == 11 and d.startswith("0"):
        return "91" + d[1:]
    return None
