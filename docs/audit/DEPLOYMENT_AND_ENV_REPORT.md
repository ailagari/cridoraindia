# Cridora India — Deployment & Environment Report

---

## 1. Deployment architecture

### Production shape

Single **Docker** container on **Railway** (inferred from settings comments and env examples; no `railway.toml` in repo).

```
Dockerfile (multi-stage)
  ├─ Stage 1: node:20-alpine → npm ci && npm run build (frontend)
  └─ Stage 2: python:3.12-slim → pip install → copy backend + frontend/dist
       CMD: migrate → collectstatic → gunicorn :PORT
```

| Component | Detail |
|-----------|--------|
| Process | Gunicorn, 2 workers, bind `0.0.0.0:${PORT:-8000}` |
| Static files | WhiteNoise (`CompressedStaticFilesStorage`) + `FRONTEND_DIST` |
| SPA routing | Django `spa_index` catch-all for non-API paths |
| Media | `FileSystemStorage`; production served via Django when `DEBUG=False` |
| Database | PostgreSQL via `DATABASE_URL` |

### Example URLs (from env example)

- Railway: `https://cridoraindia-production.up.railway.app`
- Custom domain referenced: `https://cridora.in`

---

## 2. Build process

### Web (Docker / Railway)

```bash
# Build-time (Docker ARG)
VITE_API_BASE_URL=https://your-api-origin
# VITE_CAPACITOR_BUILD must be empty/unset

npm run build   # tsc -b && vite build
```

### Local development

```bash
# Backend
cd backend && pip install -r requirements.txt
python manage.py migrate
python manage.py runserver  # :8000

# Frontend
cd frontend && npm install && npm run dev  # :5173, proxies /api → :8000
```

### Android APK

```bash
cp frontend/.env.production.local.example frontend/.env.production.local
# Set VITE_API_BASE_URL to production API

npm run build:android   # or android:apk / android:apk:debug
```

Capacitor may use `server.url` from `VITE_API_BASE_URL` for live-reload WebView against production API.

---

## 3. Environment variables

### Backend (required for production)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DJANGO_SECRET_KEY` | **Yes** | Cryptographic signing |
| `DJANGO_DEBUG` | **Yes** | Set `false` in prod |
| `DJANGO_ALLOWED_HOSTS` | **Yes** | Host header validation |
| `DATABASE_URL` | **Yes** | PostgreSQL connection |
| `VITE_API_BASE_URL` | Build-time | Baked into frontend bundle in Docker |

### Backend (recommended)

| Variable | Purpose |
|----------|---------|
| `DJANGO_PUBLIC_BASE_URL` | Absolute URLs for KYC/media links |
| `DJANGO_MEDIA_ROOT` | Persistent upload path |
| `CORS_ALLOWED_ORIGINS` | Frontend origins |
| `CSRF_TRUSTED_ORIGINS` | If using cookie auth (admin) |
| `DATABASE_PUBLIC_URL` | Local `railway run` against cloud DB |
| `DATABASE_SSL_REQUIRE` | Default true |
| `WEB_PUSH_VAPID_*` | Web push |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Native FCM |

### Backend (optional / ops)

| Variable | Purpose |
|----------|---------|
| `FRONTEND_DIST` | Override SPA path (default `../frontend/dist`) |
| `PERSONAL_HOLDING_MAX_UPLOAD_BYTES` | Upload limit |
| `CRIDORA_ADMIN_EMAIL` / `CRIDORA_ADMIN_PASSWORD` | `create_cridora_superadmin` command |
| `CRIDORA_SEED_PASSWORD` | `seed_test_users` demo data |

### Frontend

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | API origin (empty = same-origin) |
| `VITE_CAPACITOR_BUILD` | `true` for native build only |
| `VITE_FCM_ENABLED` | Disable FCM if `'false'` |

### Templates

- `frontend/.env.production.local.example` — Android/production local
- `frontend/.env.capacitor` — sets `VITE_CAPACITOR_BUILD=true`
- **No** root or `backend/.env.example`

---

## 4. Database setup

| Environment | Config |
|-------------|--------|
| Local default | SQLite `backend/db.sqlite3` if no `DATABASE_URL` |
| Production | `dj-database-url` parse, `conn_max_age=600`, SSL on |

### Migrations on deploy

Docker CMD runs `python manage.py migrate --noinput` on every container start.

### Railway local access

Settings document:

- Private URL `*.railway.internal` fails from local Windows.
- Set `DATABASE_PUBLIC_URL=${{ Postgres.DATABASE_PUBLIC_URL }}` on web service.
- Or `DJANGO_USE_PUBLIC_DATABASE=1`.

---

## 5. CI/CD

| Item | Status |
|------|--------|
| GitHub Actions | **None** (no `.github/` directory) |
| Automated tests on PR | **No** |
| Lint on CI | **No** |

Deploy appears **manual or Railway auto-deploy from git push**.

---

## 6. Storage

| Type | Backend | Production note |
|------|---------|-----------------|
| Static | WhiteNoise | Built into image |
| Media (KYC, logos) | `FileSystemStorage` | **Requires persistent volume** on Railway |
| User uploads path | `MEDIA_ROOT` env or `backend/media` | Ephemeral disk loses files on redeploy |

---

## 7. External services

| Service | Config | Required? |
|---------|--------|-----------|
| PostgreSQL | `DATABASE_URL` | Yes (prod) |
| Spot price APIs | In `spot_prices.py` | For live ticker |
| Web Push | VAPID keys | Optional |
| Firebase FCM | Service account JSON | Optional (Android push) |
| Payment gateway | — | **Not integrated** |
| Email SMTP | — | **Not configured** |
| SMS | — | **Not configured** |

---

## 8. Scheduled jobs (Railway Cron — manual setup)

Documented in management command help / README:

| Command | Suggested frequency |
|---------|---------------------|
| `python manage.py run_gold_rate_alerts` | Every 1–5 min |
| `python manage.py process_festival_broadcasts` | Every few min |
| `python manage.py run_hourly_gold_push` | Hourly |

**Also available (not always documented for cron):**

- `cross_redemption_timeout_sweep`
- `cross_redemption_recover_sagas`
- `cross_redemption_process_outbox`
- `cross_redemption_run_settlement_mvp`

---

## 9. Hosting readiness

| Criterion | Ready? |
|-----------|--------|
| Docker build | ✅ |
| Env documentation | ⚠️ Partial (settings.py + frontend example) |
| Health endpoint | ✅ `GET /api/v1/health/` |
| HTTPS | ✅ Via Railway proxy headers |
| Horizontal scale | ⚠️ Single container; stateless except media |
| Zero-downtime migrate | ⚠️ Migrate on boot — brief lock possible |
| Secrets in git | ✅ None found in audit |
| CI/CD | ❌ |

**Production pilot:** Yes, with manual payments and persistent media volume.  
**Full production (regulated payments):** No — see [SECURITY_AND_RISK_REPORT.md](./SECURITY_AND_RISK_REPORT.md).

---

## 10. Python & Node versions

| Runtime | Version |
|---------|---------|
| Node (Docker) | 20-alpine |
| Python (Docker) | 3.12-slim |
| Django | >=5.0,<6 |
| React | 18.3 |

---

*Architecture: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md).*
