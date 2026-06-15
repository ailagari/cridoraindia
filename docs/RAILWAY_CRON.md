# Railway cron — housekeeping only

Live gold/portfolio/holding notifications are **event-driven**. Do **not** schedule these for Railway cron:

| Command | Why not cron |
|---------|----------------|
| `run_gold_rate_alerts` | Runs on **GoldPriceUpdated** when spot/ticker ingests a new 22K reference |
| `run_hourly_gold_push` | Hourly digest runs inside the ingest pipeline when ≥1h elapsed |
| `run_portfolio_gain_notifications` | Portfolio rules run after ingest recalculates metrics |

Replay only (manual SSH): add `--replay` to gold/hourly commands, or run portfolio command directly.

## Event flow

1. **Ingest** — `ingest_platform_gold_price()` / jeweller rate PATCH publishes `GoldPriceUpdated`.
2. **After commit** — recalculate holdings, evaluate threshold/hourly/holding/portfolio rules, enqueue pushes, flush queue.

Triggers: live spot fetch (`/marketplace/spot-prices/`), public gold ticker GET ingest, admin gold ticker PATCH, jeweller manual rate PATCH.

## Suggested Railway cron services (housekeeping)

| Command / hook | Suggested schedule |
|----------------|-------------------|
| `process_festival_broadcasts` | Every 2–5 minutes — **prefer HTTP hook below** |
| `expire_fractional_upi_orders` | Every 5–15 minutes |
| `cross_redemption_timeout_sweep` | Every 5 minutes |
| `cross_redemption_process_outbox` | Every 1–2 minutes |
| `generate_treasury_daily_report` | Daily |
| `sync_kerala_gold_rates_history` | Once after deploy, then weekly until archive is full (~730 days) |
| `refresh_kerala_board_rates` | Every 5 minutes (polls AKGSMA → Jos → Goodreturns; updates cache only when rates change) |

### Scheduled admin broadcasts (recommended)

Railway's separate cron container often **does not tick on schedule**. The reliable path is the **inline scheduler on the main web service**:

1. On **`cridoraindia`** (Gunicorn), set `INLINE_BROADCAST_SCHEDULER=true`.
2. Deploy — each Gunicorn process starts a background loop (60s interval, Postgres advisory lock) that runs `process_due_festival_broadcasts()`.

Optional backup (external or Railway cron pinging the live app):

1. Set `CRON_SECRET` on **`cridoraindia`**.
2. Cron start command (Python — works even before `curl` is in the image):

```bash
python manage.py trigger_scheduled_broadcasts_http
```

Or with curl after deploy:

```bash
curl -fsS -X POST "https://www.cridoraindia.com/api/v1/internal/cron/process-festival-broadcasts/" -H "X-Cron-Secret: ${CRON_SECRET}"
```

`GET /api/v1/health/` also runs a throttled processor (~every 4 minutes).

Use separate **cron** services with `python manage.py <command>` or the HTTP `curl` hook above (not the main Gunicorn service start command).

### Kerala gold rate history backfill

Populates up to **2 years** of daily 22K/24K/18K gold and silver rows from Goodreturns into `KeralaGoldRateDaily` (used by `/gold-rates/kerala` charts). Live ticker updates overwrite **today** whenever Kerala board rates change.

```bash
python manage.py sync_kerala_gold_rates_history --days 730 --max-fetch 750
```

Re-run with a lower `--max-fetch` to continue if the first run times out (~2 min for 750 days at 0.15s sleep).
