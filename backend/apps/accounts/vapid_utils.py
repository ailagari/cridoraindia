"""Normalize and load VAPID keys for Web Push (pywebpush / py_vapid)."""

from __future__ import annotations

import json
import logging

from py_vapid import Vapid

logger = logging.getLogger(__name__)


def normalize_vapid_private_key_env(raw: str) -> str:
    """Parse Railway/.env private key values (JSON-quoted PEM or raw PEM)."""
    value = (raw or "").strip()
    if not value:
        return ""
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, str):
                value = parsed
        except json.JSONDecodeError:
            value = value[1:-1]
    return value.replace("\\n", "\n").strip()


def load_vapid_private_key(private_key: str) -> Vapid:
    """
    Load a Vapid signer from PEM or DER (base64) material.

    pywebpush passes strings to Vapid.from_string, which does not accept PEM
    headers — only raw/DER. PEM from generate_vapid_keys must use from_pem.
    """
    key = normalize_vapid_private_key_env(private_key)
    if not key:
        raise ValueError("empty VAPID private key")
    if "-----BEGIN" in key:
        return Vapid.from_pem(key.encode("utf-8"))
    return Vapid.from_string(key)


def vapid_signer_ready(public_key: str, private_key: str) -> bool:
    pub = (public_key or "").strip()
    if not pub:
        return False
    try:
        load_vapid_private_key(private_key)
        return True
    except Exception as exc:
        logger.warning("VAPID private key could not be loaded: %s", exc)
        return False
