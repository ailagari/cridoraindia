"""
Django settings for Cridora India (defaults suit local development).
"""
import os
from pathlib import Path

from datetime import timedelta

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-change-me")

DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() in ("1", "true", "yes")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if h.strip()
]

FRONTEND_DIST = Path(
    os.environ.get("FRONTEND_DIST", str(BASE_DIR.parent / "frontend" / "dist"))
).resolve()

# Absolute URLs for KYC document links in emails/admin when Request has no Host (optional).
DJANGO_PUBLIC_BASE_URL = (os.environ.get("DJANGO_PUBLIC_BASE_URL") or "").strip().rstrip("/")

# Optional: meta tag content for Google Search Console domain verification.
GOOGLE_SITE_VERIFICATION = (os.environ.get("GOOGLE_SITE_VERIFICATION") or "").strip()
GOOGLE_OAUTH_CLIENT_ID = (os.environ.get("GOOGLE_OAUTH_CLIENT_ID") or "").strip()

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "apps.accounts",
    "apps.marketplace",
    "apps.schemes",
]

MIDDLEWARE = [
    "config.middleware.SeoFilesMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


def _database_url_from_env() -> str:
    """
    Railway (and similar) often set DATABASE_URL to a private hostname (*.railway.internal)
    that only resolves inside their network. Local `railway run` cannot use that.

    Fix in Railway dashboard: on your **web/Django** service, add variable
    DATABASE_PUBLIC_URL = ${{ Postgres.DATABASE_PUBLIC_URL }}  (match your DB service name).

    Or set DATABASE_EXTERNAL_URL to the full public postgresql://... string (TCP proxy).

    Override: DJANGO_USE_PUBLIC_DATABASE=1 forces the first available public-style URL below.
    """
    private = (os.environ.get("DATABASE_URL") or "").strip()
    public_raw = (
        (os.environ.get("DATABASE_PUBLIC_URL") or "").strip()
        or (os.environ.get("DATABASE_EXTERNAL_URL") or "").strip()
    )
    force_public = os.environ.get("DJANGO_USE_PUBLIC_DATABASE", "").lower() in (
        "1",
        "true",
        "yes",
    )

    uses_private_dns = bool(
        private
        and (
            ".railway.internal" in private or "railway.internal" in private
        )
    )

    if force_public and public_raw:
        return public_raw

    if uses_private_dns and public_raw:
        return public_raw

    return private or public_raw


DATABASE_URL = _database_url_from_env()
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=os.environ.get("DATABASE_SSL_REQUIRE", "true").lower()
            in ("1", "true", "yes"),
        ),
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-in"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
WHITENOISE_ROOT = FRONTEND_DIST
MEDIA_URL = "/media/"


def _resolve_media_root() -> Path:
    """Persistent uploads: DJANGO_MEDIA_ROOT, or Railway volume at $RAILWAY_VOLUME_MOUNT_PATH/media."""
    explicit = (os.environ.get("DJANGO_MEDIA_ROOT") or "").strip()
    if explicit:
        return Path(explicit).resolve()
    volume_mount = (os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") or "").strip().rstrip("/")
    if volume_mount:
        return (Path(volume_mount) / "media").resolve()
    return (BASE_DIR / "media").resolve()


MEDIA_ROOT = _resolve_media_root()

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = False
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

_CAPACITOR_ORIGINS = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "https://localhost",
    "http://localhost",
    "https://capacitor.localhost",
    "http://capacitor.localhost",
    "capacitor://localhost",
)
CORS_ALLOWED_ORIGINS = list(
    dict.fromkeys(
        [
            o.strip()
            for o in os.environ.get("CORS_ALLOWED_ORIGINS", ",".join(_CAPACITOR_ORIGINS)).split(",")
            if o.strip()
        ]
        + list(_CAPACITOR_ORIGINS)
    )
)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://([a-zA-Z0-9-]+\.)?localhost$",
    r"^http://([a-zA-Z0-9-]+\.)?localhost$",
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",")
    if o.strip()
]

FILE_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024

# Personal holdings vault: max upload size per document (bytes); align with DATA_UPLOAD_MAX_MEMORY_SIZE in production.
PERSONAL_HOLDING_MAX_UPLOAD_BYTES = int(
    os.environ.get("PERSONAL_HOLDING_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024))
)

# Smart Gold Invoice Import (Gemini Vision).
GEMINI_API_KEY = (os.environ.get("GEMINI_API_KEY") or "").strip()

# Web Push (VAPID). Generate keys: python manage.py generate_vapid_keys
WEB_PUSH_VAPID_PUBLIC_KEY = (os.environ.get("WEB_PUSH_VAPID_PUBLIC_KEY") or "").strip()
WEB_PUSH_VAPID_PRIVATE_KEY = (os.environ.get("WEB_PUSH_VAPID_PRIVATE_KEY") or "").strip()
WEB_PUSH_VAPID_CONTACT = (
    os.environ.get("WEB_PUSH_VAPID_CONTACT") or "mailto:ops@cridora.in"
).strip()

# Firebase Cloud Messaging for Capacitor Android/iOS (JSON service account string).
FIREBASE_SERVICE_ACCOUNT_JSON = (os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip()

CRIDORA_PLATFORM_UPI_VPA = (os.environ.get("CRIDORA_PLATFORM_UPI_VPA") or "").strip()
CRIDORA_PLATFORM_UPI_NAME = (os.environ.get("CRIDORA_PLATFORM_UPI_NAME") or "Cridora").strip()
