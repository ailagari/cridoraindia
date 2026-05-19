"""Dashboard deep links for push / in-app notification taps."""

from __future__ import annotations


def customer_dashboard(section: str, **query: str) -> str:
    parts = [f"section={section}"]
    for key, val in query.items():
        if val:
            parts.append(f"{key}={val}")
    return f"/userdashboard?{'&'.join(parts)}"


def jeweller_dashboard(section: str, **query: str) -> str:
    parts = [f"section={section}"]
    for key, val in query.items():
        if val:
            parts.append(f"{key}={val}")
    return f"/dashboard/jeweller?{'&'.join(parts)}"
