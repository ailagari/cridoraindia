"""Fetch Kerala board gold/silver ₹/g from AKGSMA (primary live reference)."""

from __future__ import annotations

import logging
import re
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

AKGSMA_URL = "https://akgsma.com/"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
}

_BIS_916 = 0.916
_BIS_750 = 0.750
_SILVER_925 = 0.925

_RE_RATE_DATE = re.compile(
    r"Today['\u2019]s\s+Rate\s*\(\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*\)",
    re.IGNORECASE,
)
_RE_22K916 = re.compile(
    r"22K\s*916\s*\(1\s*gm\)\s*[-–—]\s*(?:₹|\u20b9|Rs\.?)\s*([\d,]+)",
    re.IGNORECASE,
)
_RE_18K750 = re.compile(
    r"18K\s*750\s*\(1\s*gm\)\s*[-–—]\s*(?:₹|\u20b9|Rs\.?)\s*([\d,]+)",
    re.IGNORECASE,
)
_RE_SILVER = re.compile(
    r"(?<!925\s)(?<!Hall\sMarked\s)Silver\s*\(1\s*gm\)\s*[-–—]\s*(?:₹|\u20b9|Rs\.?)\s*([\d,]+)",
    re.IGNORECASE,
)
_RE_SILVER_925 = re.compile(
    r"925\s+Hall\s+Marked\s+Silver\s*\(1\s*gm\)\s*[-–—]\s*(?:₹|\u20b9|Rs\.?)\s*([\d,NA]+)",
    re.IGNORECASE,
)


def _parse_inr_amount(raw: str) -> float | None:
    text = str(raw or "").strip().upper()
    if not text or text in ("NA", "N/A", "-"):
        return None
    try:
        v = float(text.replace(",", ""))
    except (TypeError, ValueError):
        return None
    if v <= 0 or v > 50000:
        return None
    return round(v, 2)


def _parse_rate_date(html: str) -> str:
    m = _RE_RATE_DATE.search(html or "")
    if not m:
        return ""
    dd, mm, yyyy = m.group(1), m.group(2), m.group(3)
    try:
        return date(int(yyyy), int(mm), int(dd)).isoformat()
    except ValueError:
        return ""


def parse_akgsma_rates_from_html(html: str) -> dict | None:
    """Parse AKGSMA Today's Rate block (22K916, 18K750, silver ₹/g)."""
    if not html or not isinstance(html, str):
        return None

    k22_m = _RE_22K916.search(html)
    if not k22_m:
        return None
    k22 = _parse_inr_amount(k22_m.group(1))
    if k22 is None:
        return None

    gold: dict[str, float] = {"22K": k22}
    k18_m = _RE_18K750.search(html)
    if k18_m:
        k18 = _parse_inr_amount(k18_m.group(1))
        if k18 is not None:
            gold["18K"] = k18
    gold["24K"] = round(k22 / _BIS_916, 2)

    silver: dict[str, float] = {}
    s_m = _RE_SILVER.search(html)
    if s_m:
        s999 = _parse_inr_amount(s_m.group(1))
        if s999 is not None:
            silver["999"] = round(s999, 3)
    s925_m = _RE_SILVER_925.search(html)
    if s925_m:
        s925 = _parse_inr_amount(s925_m.group(1))
        if s925 is not None:
            silver["925"] = round(s925, 3)
    if silver.get("999") is not None and silver.get("925") is None:
        silver["925"] = round(silver["999"] * _SILVER_925, 3)

    rate_date = _parse_rate_date(html)
    source_updated_at = rate_date or ""

    return {
        "gold": gold,
        "silver": silver,
        "source_updated_at": source_updated_at,
        "rate_date": rate_date,
        "source": "akgsma_kerala",
    }


def _http_get_html(url: str, timeout: float = 12.0) -> str | None:
    try:
        req = Request(url, headers=_HEADERS)
        with urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", "replace")
    except (HTTPError, URLError, TimeoutError, OSError, UnicodeDecodeError) as exc:
        logger.debug("AKGSMA fetch failed: %s", exc)
        return None


def fetch_akgsma_rates_from_web() -> dict | None:
    html = _http_get_html(AKGSMA_URL)
    if not html:
        return None
    return parse_akgsma_rates_from_html(html)
