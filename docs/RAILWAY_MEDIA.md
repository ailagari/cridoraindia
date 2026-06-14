# Railway persistent media (gold rates banners, KYC, logos)

Uploaded files (gold rates ad images/videos, jeweller logos, KYC documents) are stored on disk via Django `FileSystemStorage`. They are **not** in git and are **not** baked into the Docker image.

Every git push redeploys a **new container** with an empty filesystem unless you attach a **Railway Volume**.

## One-time Railway setup

1. Open your **web/Django** service in the Railway dashboard.
2. **Volumes** → **Add Volume** → mount path: `/data`
3. **Variables** → add:
   ```
   DJANGO_MEDIA_ROOT=/data/media
   ```
4. Redeploy (or push any commit). The container runs `ensure_media_root` on start to create `/data/media`.

## Verify after deploy

```bash
curl https://YOUR-SERVICE.up.railway.app/api/v1/health/
```

Look for the `media` block:

- `persistent_volume_configured`: should be `true`
- `media_root`: should be `/data/media` (not `/app/backend/media`)
- `writable`: should be `true`
- After uploading a gold rates banner, `gold_rates_ad_images` count should be > 0 and **stay > 0** after the next git push.

## Re-upload after fixing volume

URLs in PostgreSQL survive redeploys, but files uploaded **before** the volume was attached are gone. Re-upload gold rates banners/videos from the admin dashboard once the volume is configured.

## Local development

Leave `DJANGO_MEDIA_ROOT` unset; files go to `backend/media/` (gitignored).
