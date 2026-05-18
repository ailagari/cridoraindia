"""Public cross-redemption reference ids (CRX-YYYY-NNNNNN)."""

from __future__ import annotations

from django.utils import timezone


def cross_redemption_public_reference(request_id: int, *, when=None) -> str:
    year = (when or timezone.now()).year
    return f"CRX-{year}-{request_id:06d}"
