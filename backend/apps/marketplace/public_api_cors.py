"""Open CORS for read-only public marketplace rate endpoints (poster tools, embeds)."""

from __future__ import annotations

from rest_framework.response import Response

PUBLIC_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Max-Age": "86400",
}


def public_cors_response(data, *, status=200) -> Response:
    resp = Response(data, status=status)
    for key, value in PUBLIC_CORS_HEADERS.items():
        resp[key] = value
    return resp
