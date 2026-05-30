# Push & tray notifications — how it works

Cridora delivers alerts in two places:

| Surface | What the user sees | Technology |
|--------|---------------------|------------|
| **Bell (in-app)** | Inbox list, categories, mark-read | `GET /api/v1/inbox/` |
| **Tray (OS)** | Phone / desktop notification shade, Action Center | **Web Push** (PWA) or **FCM** (Android APK) |

Tray alerts are **not** the bell. The bell is history inside the app; the tray is the system UI outside the app.

---

## User flow (bell → tray)

1. User opens the **notification bell**.
2. At the top of the panel, **Notification tray** section shows:
   - **Turn on tray notifications** — subscribes this device (permission prompt).
   - **Tray notifications on** — device is subscribed; server can push to the tray.
   - **Blocked** — permission denied; on Android APK, **Open app settings** uses Capacitor `App.openAppSettings()`.
3. iOS Safari (not installed): instructions to **Add to Home Screen**, then turn on from the bell.
4. **Notification settings** (profile) controls *which types* of alerts are sent; tray section controls *whether the OS can show them*.

---

## Which technology runs on each device

The app picks the channel automatically (`registerWebPushSubscription` in `frontend/src/lib/webPushApi.ts`):

```
                    ┌─────────────────────────────────────┐
                    │         Django backend               │
                    │  notify_inbox → send_push_to_user    │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     WebPushSubscription    NativePushToken      (same payload)
     (VAPID / pywebpush)    (FCM HTTP v1)
              │                    │
              ▼                    ▼
     service worker          Capacitor FCM
     showNotification        system tray
              │                    │
              ▼                    ▼
     PWA / browser /           Android APK
     Windows installed PWA
     iOS 16.4+ (A2HS)
```

| Install type | Client registration | Server send | Tray |
|--------------|---------------------|-------------|------|
| Chrome / Edge / installed PWA (Android, Windows, desktop) | `POST /api/v1/push/subscribe/` (PushManager + VAPID) | `webpush_service.py` | Yes |
| iPhone/iPad **installed from Safari** (iOS 16.4+) | Same Web Push | `webpush_service.py` | Yes |
| iPhone **Safari tab only** | Not supported | — | Use Add to Home Screen first |
| **Android APK** (Capacitor) | `POST /api/v1/push/native-subscribe/` (FCM token) | `fcm_service.py` | Yes |

**Important:** Browser PWAs do **not** use FCM device tokens in JavaScript. FCM is for the native Android shell only. Web Push may still route through Google’s infrastructure on Android Chrome, but the app uses the **Push API + service worker**, not the Firebase web SDK.

---

## Backend

- **Unified send:** `send_push_to_user()` in `backend/apps/accounts/webpush_service.py` sends to all `WebPushSubscription` rows for the user, then `fcm_service.send_fcm_to_user()`.
- **Inbox + push:** `notify_inbox()` in `backend/apps/accounts/services/inbox_notify.py` creates inbox rows and calls push when preferences allow.
- **Preferences:** `NotificationPreference.allow_push_notifications` and per-category flags gate delivery.

### VAPID private key format (important)

`generate_vapid_keys` outputs a **PEM** private key. The server must load it with `Vapid.from_pem`, not `Vapid.from_string` (which only accepts raw/DER). Cridora uses `apps/accounts/vapid_utils.py` for this. Verify on the server:

```bash
python manage.py test_vapid_keys
```

If sends fail with `Invalid base64-encoded string`, redeploy after the PEM loader fix or re-paste keys from `generate_vapid_keys`.

### Environment (Railway / production)

| Variable | Purpose |
|----------|---------|
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Browser/PWA subscribe |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Server sign Web Push |
| `WEB_PUSH_VAPID_CONTACT` | `mailto:` contact for VAPID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | FCM for Android APK tokens |
| `DJANGO_PUBLIC_BASE_URL` | HTTPS links/images in notifications |

Android APK also needs `google-services.json` in the Capacitor Android project (`npm run build:android`).

---

## Frontend files

| File | Role |
|------|------|
| `frontend/src/components/NotificationBell.tsx` | Tray CTA, inbox list, settings link |
| `frontend/src/lib/webPushApi.ts` | Web Push subscribe, hints, permission checks |
| `frontend/src/lib/nativeNotifications.ts` | FCM token, Android channel, `openAppSettings` |
| `frontend/src/sw.ts` | Service worker `showNotification` for Web Push |
| `frontend/src/features/settings/NotificationSettingsPanel.tsx` | Per-category toggles + enable push |
| `frontend/src/context/AuthContext.tsx` | Re-associates subscription after login |

---

## After login

`claimPushSubscriptionForLoggedInUser()` runs on sign-in so an anonymous Web Push subscription is linked to the account without asking again.

---

## Testing

1. **PWA / desktop:** Bell → Turn on tray → allow permission → Admin **Send test notification** (admin bell) or trigger a real inbox event.
2. **Android APK:** Same bell button → Android permission → verify token in `NativePushToken` → test push from admin or `send_push_to_user`.
3. **iOS:** Install via Safari **Add to Home Screen**, open from icon, then turn on in bell.

---

## Automated engines (gold & portfolio) — event-driven

Live alerts are **not** driven by Railway cron. On each platform or jeweller price ingest, the app publishes `GoldPriceUpdated`, recalculates holdings, evaluates rules, enqueues tray pushes, and flushes the queue.

| Engine | Trigger | Delivery |
|--------|---------|----------|
| **Platform 22K** | Spot ingest, gold ticker API, admin ticker PATCH | Threshold broadcast + inbox/tray (`allow_gold_alerts`) |
| **Jeweller manual rate** | Jeweller pricing profile PATCH | Inbox + tray + jeweller `logo_url` when HTTPS |
| **Personal holding gain** | Same ingest pipeline | Gain-only per item |
| **Portfolio aggregate** | Same ingest pipeline | Deduped vs `UserPortfolioNotificationState` |
| **Hourly digest** | Ingest when ≥1h since hourly baseline | Broadcast (not a separate cron) |

Code: `backend/apps/marketplace/gold_price_events.py`, `gold_price_notification_pipeline.py`.  
Cron policy: `docs/RAILWAY_CRON.md` (housekeeping only).

---

## Engagement Engine (templates)

Marketing copy lives in **`NotificationTemplate`** rows: **moment** (`category`) + **context** + **locale**. Business logic builds **facts** (portfolio value, holding gain, `festival_name`, `years_held`, monthly storytelling aggregates); rendering substitutes `{{variables}}` safely.

| Moment | Typical trigger |
|--------|-----------------|
| `portfolio_growth` | `GoldPriceUpdated` ingest |
| `portfolio_milestone` | Portfolio value crosses ticker thresholds |
| `holding_appreciation` | Per-holding gain (gain-only) |
| `holding_milestone` | Holding value crosses threshold |
| `market_awareness` | Gold rate move / educational (ingest) |

Contexts: `default`, `festival` (use `{{festival_name}}`), `jeweller_campaign`, `educational`.  
**Not** separate contexts per holiday (Vishu/Onam are fact values).

- Seed defaults: `python manage.py seed_engagement_templates`
- Admin API: `/api/v1/admin/notification-templates/`, preview, variables catalog
- Jeweller campaigns: `POST /api/v1/jeweller/campaigns/` (same `FestivalBroadcastNotification` processor)
- Delivery unchanged: `notify_inbox` → `PortfolioUserNotification` + tray push

Code: `backend/apps/accounts/services/engagement_*.py`, `deliver_engagement.py`.

---

## Related docs

- Full product spec: `docs/notificationsystem.md`
- Railway migrations / env: `docs/RAILWAY_MIGRATIONS.md` (if present)
