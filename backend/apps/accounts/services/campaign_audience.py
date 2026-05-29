"""Resolve user IDs for notification campaign targeting."""

from __future__ import annotations

from django.contrib.auth import get_user_model

User = get_user_model()

TARGET_ALL_USERS = "ALL_USERS"
TARGET_ALL_APP_INSTALLS = "ALL_APP_INSTALLS"
TARGET_SPECIFIC_JEWELLER_USERS = "SPECIFIC_JEWELLER_USERS"
TARGET_DEFAULT_JEWELLER_USERS = "DEFAULT_JEWELLER_USERS"
TARGET_SPECIFIC_USERS = "SPECIFIC_USERS"


def resolve_campaign_user_ids(
    target_type: str,
    target_metadata: dict | None,
) -> list[int]:
    meta = target_metadata or {}
    if target_type in ("", TARGET_ALL_USERS, TARGET_ALL_APP_INSTALLS):
        return list(
            User.objects.filter(
                user_type=User.CUSTOMER,
                is_active=True,
            ).values_list("pk", flat=True)
        )
    if target_type == TARGET_DEFAULT_JEWELLER_USERS:
        jeweller_id = meta.get("jeweller_id")
        if not jeweller_id:
            return []
        return list(
            User.objects.filter(
                user_type=User.CUSTOMER,
                is_active=True,
                default_jeweller_id=jeweller_id,
            ).values_list("pk", flat=True)
        )
    if target_type == TARGET_SPECIFIC_JEWELLER_USERS:
        jeweller_id = meta.get("jeweller_id")
        if not jeweller_id:
            return []
        from apps.accounts.models import FractionalGoldPurchase

        ids: set[int] = set(
            FractionalGoldPurchase.objects.filter(jeweller_id=jeweller_id).values_list(
                "customer_id", flat=True
            )
        )
        ids.update(
            User.objects.filter(
                user_type=User.CUSTOMER,
                is_active=True,
                default_jeweller_id=jeweller_id,
            ).values_list("pk", flat=True)
        )
        return [i for i in ids if i]
    if target_type == TARGET_SPECIFIC_USERS:
        raw = meta.get("user_ids") or []
        if not isinstance(raw, list):
            return []
        out = []
        for x in raw[:5000]:
            try:
                out.append(int(x))
            except (TypeError, ValueError):
                continue
        return out
    return []
