"""Google OAuth ID token verification and customer signup/login."""

from __future__ import annotations

import secrets
import urllib.error
import urllib.parse
import urllib.request
import json

from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()


class GoogleAuthError(Exception):
    pass


def google_oauth_client_id() -> str:
    return (getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", None) or "").strip()


def google_auth_configured() -> bool:
    return bool(google_oauth_client_id())


def verify_google_id_token(id_token: str) -> dict:
    """Verify Google Sign-In credential; returns token claims."""
    token = (id_token or "").strip()
    if not token:
        raise GoogleAuthError("Google credential is required.")
    if not google_auth_configured():
        raise GoogleAuthError("Google sign-in is not configured on the server.")

    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": token})
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise GoogleAuthError("Invalid or expired Google credential.") from exc
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as exc:
        raise GoogleAuthError("Could not verify Google credential.") from exc

    aud = (payload.get("aud") or "").strip()
    expected = google_oauth_client_id()
    if aud != expected:
        raise GoogleAuthError("Google credential audience mismatch.")

    sub = (payload.get("sub") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    if not sub or not email:
        raise GoogleAuthError("Google credential missing email or subject.")

    email_verified = str(payload.get("email_verified", "")).lower() in ("true", "1")
    if not email_verified:
        raise GoogleAuthError("Google email is not verified.")

    given = (payload.get("given_name") or "").strip()
    family = (payload.get("family_name") or "").strip()
    full = (payload.get("name") or "").strip()
    if not given and full:
        parts = full.split(None, 1)
        given = parts[0]
        family = parts[1] if len(parts) > 1 else ""

    return {
        "sub": sub,
        "email": email,
        "given_name": given,
        "family_name": family,
        "picture": (payload.get("picture") or "").strip(),
    }


def user_profile_complete(user) -> bool:
    phone = (user.phone or "").strip()
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return bool(phone and name)


def authenticate_or_register_google_customer(
    claims: dict,
    *,
    referral_code: str | None = None,
    jeweller_id: int | None = None,
) -> tuple[User, bool, str | None]:
    """
    Returns (user, created, referral_warning).
    Only customers may use Google auth through this path.
    """
    from apps.accounts.services.jeweller_referral import apply_customer_onboarding_jeweller

    sub = claims["sub"]
    email = claims["email"]

    by_sub = User.objects.filter(google_sub=sub).first()
    if by_sub:
        if by_sub.user_type != User.CUSTOMER:
            raise GoogleAuthError("This Google account is linked to a non-customer login.")
        return by_sub, False, None

    by_email = User.objects.filter(email__iexact=email).first()
    if by_email:
        if by_email.user_type != User.CUSTOMER:
            raise GoogleAuthError("Use jeweller or admin login for this email.")
        if by_email.google_sub and by_email.google_sub != sub:
            raise GoogleAuthError("This email is linked to a different Google account.")
        if not by_email.google_sub:
            by_email.google_sub = sub
            by_email.auth_provider = User.AUTH_GOOGLE
            by_email.save(update_fields=["google_sub", "auth_provider"])
        return by_email, False, None

    user = User.objects.create_user(
        username=email,
        email=email,
        password=secrets.token_urlsafe(32),
        first_name=claims.get("given_name") or "",
        last_name=claims.get("family_name") or "",
        user_type=User.CUSTOMER,
        auth_provider=User.AUTH_GOOGLE,
        google_sub=sub,
    )
    picture = claims.get("picture") or ""
    if picture and not user.profile_photo_url:
        user.profile_photo_url = picture[:512]
        user.save(update_fields=["profile_photo_url"])

    warning = apply_customer_onboarding_jeweller(
        user,
        referral_code=referral_code or None,
        jeweller_id=jeweller_id,
    )
    return user, True, warning or None
