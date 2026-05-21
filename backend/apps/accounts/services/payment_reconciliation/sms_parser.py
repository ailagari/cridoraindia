"""Parse Indian bank UPI debit SMS for reconciliation signals."""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

UTR_PATTERNS = [
    re.compile(r"UPI Ref No\s*[:\-]?\s*(\d+)", re.I),
    re.compile(r"Ref No\s*[:\-]?\s*(\d+)", re.I),
    re.compile(r"UTR\s*[:\-]?\s*(\d+)", re.I),
    re.compile(r"Transaction ID\s*[:\-]?\s*(\d+)", re.I),
]
AMOUNT_RE = re.compile(r"Rs\.?\s*([\d,]+(?:\.\d{1,2})?)", re.I)
VPA_TO_RE = re.compile(
    r"to\s+([a-z0-9._-]+@[a-z0-9._-]+)",
    re.I,
)


@dataclass(frozen=True)
class ParsedSMS:
    utr: str
    amount_inr: Decimal | None
    receiver_vpa: str
    raw_text: str


def _parse_amount(raw: str) -> Decimal | None:
    cleaned = raw.replace(",", "").strip()
    try:
        val = Decimal(cleaned).quantize(Decimal("0.01"))
        return val if val > 0 else None
    except (InvalidOperation, ValueError):
        return None


def parse_sms(raw_text: str) -> ParsedSMS | None:
    text = (raw_text or "").strip()
    if len(text) < 10:
        return None
    utr = ""
    for pat in UTR_PATTERNS:
        m = pat.search(text)
        if m:
            utr = m.group(1).strip()
            break
    amount_inr = None
    am = AMOUNT_RE.search(text)
    if am:
        amount_inr = _parse_amount(am.group(1))
    receiver_vpa = ""
    vpa_m = VPA_TO_RE.search(text)
    if vpa_m:
        receiver_vpa = vpa_m.group(1).strip().lower()
    if not utr and amount_inr is None and not receiver_vpa:
        return None
    return ParsedSMS(
        utr=utr,
        amount_inr=amount_inr,
        receiver_vpa=receiver_vpa,
        raw_text=text[:2000],
    )
