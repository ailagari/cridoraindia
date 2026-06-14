# Railway persistent media (gold rates banners, KYC, logos)

Uploaded files (gold rates ad images/videos, jeweller logos, KYC documents) are stored on disk via Django `FileSystemStorage`. They are **not** in git and are **not** baked into the Docker image.

Every git push redeploys a **new container** with an empty filesystem unless you attach a **Railway Volume**.

## One-time Railway setup

### Option A — Railway dashboard

1. Open your **web/Django** service (not Postgres).
2. **Volumes** → **Add Volume** → mount path: **`/data`**
3. **Variables** (recommended, explicit):
   ```
   DJANGO_MEDIA_ROOT=/data/media
   ```
4. Redeploy (push a commit or click Redeploy).

### Option B — Railway CLI

```bash
railway link
railway volume add --mount-path /data
railway variables set DJANGO_MEDIA_ROOT=/data/media
```

If you mount the volume at `/data` but skip `DJANGO_MEDIA_ROOT`, Django automatically uses `/data/media` via Railway’s `RAILWAY_VOLUME_MOUNT_PATH` variable.

## Verify after deploy

```bash
curl https://YOUR-SERVICE.up.railway.app/api/v1/health/
```

Look for the `media` block:

| Field | Expected |
|-------|----------|
| `persistent_volume_configured` | `true` |
| `media_root` | `/data/media` (not `/app/backend/media`) |
| `writable` | `true` |
| `gold_rates_ad_images` | increases after upload, **unchanged** after next git push |

## Re-upload after fixing volume

URLs in PostgreSQL survive redeploys, but files uploaded **before** the volume was attached are gone. Re-upload gold rates banners/videos from the admin dashboard once the volume is configured.

## Local development

Leave `DJANGO_MEDIA_ROOT` and `RAILWAY_VOLUME_MOUNT_PATH` unset; files go to `backend/media/` (gitignored).

## Deploy logs

If no volume is configured in production, `ensure_media_root` prints a **WARNING** on every container start. Check Railway deploy logs if media disappears after push.
