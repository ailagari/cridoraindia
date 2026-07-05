# Custom domain down (maintenance / connection hiccup)

## Symptom

- `www.cridoraindia.com` shows **Maintenance**, **Connection hiccup**, or never loads
- Phone and PC both affected
- Direct Railway URL may still work

## Quick test (from your PC)

```bash
curl -I --max-time 15 https://www.cridoraindia.com/api/v1/health/
curl -I --max-time 15 https://cridoraindia-production.up.railway.app/api/v1/health/
```

| Result | Meaning |
|--------|---------|
| Railway **200**, custom domain **timeout** or **000** | Backend is fine — **Cloudflare / DNS / custom domain** routing is broken |
| Both **502/503** | Web service not running Gunicorn — see [RAILWAY_CRON.md](./RAILWAY_CRON.md) |
| Both timeout | Railway outage or network block |

**Temporary public URL:** `https://cridoraindia-production.up.railway.app`

## Fix custom domain (Railway + Cloudflare)

1. **Railway** → service **`cridoraindia`** → **Settings** → **Networking** → **Custom Domain**
   - `www.cridoraindia.com` and `cridoraindia.com` must show **Active** (not pending/failed)
   - Copy the Railway target hostname (e.g. `xxxx.up.railway.app`)

2. **Cloudflare** → **DNS**
   - `www` → **CNAME** → Railway hostname (orange cloud **Proxied** is OK)
   - `@` (apex) → **CNAME** or flatten to Railway per Railway docs

3. **Cloudflare** → **SSL/TLS**
   - Mode: **Full (strict)** recommended
   - Edge certificate: valid for `cridoraindia.com` / `www`

4. **Cloudflare** → **Security**
   - Temporarily disable **Under Attack** mode if enabled
   - Check WAF rules blocking India / mobile networks

5. **Railway start command** (web service only — must be Gunicorn):

```bash
sh -c "python manage.py migrate --noinput && python manage.py collectstatic --noinput && python manage.py ensure_media_root && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --worker-class gthread --threads 6 --timeout 60"
```

Never set the main web service start command to a cron command (`process_festival_broadcasts`, etc.) — that causes **502** on all domains.

6. After DNS/SSL changes, wait 2–5 minutes, then:

```bash
curl -I https://www.cridoraindia.com/api/v1/health/
```

## User devices stuck on offline page

The PWA service worker may cache the offline shell. On affected browsers:

1. Site settings → **Clear data** for cridoraindia.com
2. DevTools → **Application** → **Service workers** → **Unregister**
3. Or use the direct Railway URL until the custom domain is fixed

## Environment variables (production)

Ensure on **`cridoraindia`** Railway service:

- `DJANGO_ALLOWED_HOSTS` includes `www.cridoraindia.com,cridoraindia.com,.up.railway.app`
- `CSRF_TRUSTED_ORIGINS` includes `https://www.cridoraindia.com,https://cridoraindia.com`
