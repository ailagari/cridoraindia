import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

type FestivalRow = {
  id: number
  title: string
  body: string
  image_url: string
  scheduled_at: string
  status: string
  sent_at: string | null
  push_recipient_count: number | null
  error_message: string
  created_by_email: string
  created_at: string
}

type GoldAlertSettings = {
  platform_base_inr_per_gram_22k: string
  rate_move_alert_threshold_inr: string
  rate_move_alerts_enabled: boolean
  rate_alert_baseline_inr_per_gram_22k: string | null
  hourly_gold_push_enabled: boolean
  hourly_gold_push_title: string
  hourly_gold_push_link: string
  rate_move_alert_title: string
  rate_move_alert_link: string
  gold_push_image_url: string
  hourly_gold_push_baseline_inr_per_gram_22k: string | null
  hourly_gold_push_baseline_recorded_at: string | null
  portfolio_gain_threshold_inr?: string
  portfolio_gain_threshold_percent?: string
  holding_gain_threshold_inr?: string
  max_gold_alerts_per_day?: number
  last_platform_rate_change?: {
    previous_rate: string
    new_rate: string
    difference: string
    created_at: string
  } | null
}

function statusTone(s: string): string {
  if (s === 'sent') return 'ok'
  if (s === 'pending') return 'wait'
  if (s === 'cancelled') return 'mute'
  if (s === 'failed') return 'bad'
  return 'mute'
}

function fmtWhen(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString()
}

type HubTab = 'campaigns' | 'gold'

export function AdminFestivalBroadcastPanel({ tab }: { tab?: HubTab }) {
  const showGold = tab == null || tab === 'gold'
  const showCampaigns = tab == null || tab === 'campaigns'
  const [rows, setRows] = useState<FestivalRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [title, setTitle] = useState('Cridora')
  const [body, setBody] = useState('')
  const [festImageUrl, setFestImageUrl] = useState('')
  const [targetType, setTargetType] = useState('ALL_USERS')
  const [targetJewellerId, setTargetJewellerId] = useState('')
  const [scheduledLocal, setScheduledLocal] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelId, setCancelId] = useState<number | null>(null)

  const [goldSettings, setGoldSettings] = useState<GoldAlertSettings | null>(null)
  const [goldLoadErr, setGoldLoadErr] = useState('')
  const [goldSaveErr, setGoldSaveErr] = useState('')
  const [goldBusy, setGoldBusy] = useState(false)
  const [goldSaved, setGoldSaved] = useState('')

  const [hourlyEnabled, setHourlyEnabled] = useState(true)
  const [hourlyTitle, setHourlyTitle] = useState('Gold price update')
  const [hourlyLink, setHourlyLink] = useState('/marketplace')
  const [thresholdEnabled, setThresholdEnabled] = useState(true)
  const [thresholdInr, setThresholdInr] = useState('10')
  const [thresholdTitle, setThresholdTitle] = useState('Gold rate alert')
  const [thresholdLink, setThresholdLink] = useState('/marketplace')
  const [goldImageUrl, setGoldImageUrl] = useState('')
  const [holdingGainInr, setHoldingGainInr] = useState('500')
  const [maxGoldAlertsDay, setMaxGoldAlertsDay] = useState('3')
  const [portfolioGainInr, setPortfolioGainInr] = useState('500')
  const [portfolioGainPct, setPortfolioGainPct] = useState('2')
  const [sendPushBusy, setSendPushBusy] = useState(false)
  const [sendPushMsg, setSendPushMsg] = useState('')
  const [festEngagementContext, setFestEngagementContext] = useState('')
  const [festEngagementMoment, setFestEngagementMoment] = useState('')
  const [festFestivalName, setFestFestivalName] = useState('')
  const [festPersonalize, setFestPersonalize] = useState(false)
  const [activeEngagementContext, setActiveEngagementContext] = useState('default')
  const [activeFestivalName, setActiveFestivalName] = useState('')
  const [enableEducational, setEnableEducational] = useState(false)

  const loadFestivals = useCallback(async () => {
    setLoadErr('')
    const res = await authFetch('/api/v1/admin/festival-broadcasts/')
    const data = (await res.json().catch(() => ({}))) as {
      results?: FestivalRow[]
      detail?: string
    }
    if (!res.ok) {
      setRows([])
      setLoadErr(data.detail != null ? String(data.detail) : 'Could not load schedules.')
      return
    }
    setRows(Array.isArray(data.results) ? data.results : [])
  }, [])

  const loadGoldSettings = useCallback(async () => {
    setGoldLoadErr('')
    const res = await authFetch('/api/v1/admin/gold-ticker/')
    const data = (await res.json().catch(() => ({}))) as GoldAlertSettings & { detail?: string }
    if (!res.ok) {
      setGoldSettings(null)
      setGoldLoadErr(data.detail != null ? String(data.detail) : 'Could not load gold alert settings.')
      return
    }
    setGoldSettings(data)
    setHourlyEnabled(data.hourly_gold_push_enabled !== false)
    setHourlyTitle(data.hourly_gold_push_title?.trim() || 'Gold price update')
    setHourlyLink(data.hourly_gold_push_link?.trim() || '/marketplace')
    setThresholdEnabled(data.rate_move_alerts_enabled !== false)
    setThresholdInr(data.rate_move_alert_threshold_inr ?? '10')
    setThresholdTitle(data.rate_move_alert_title?.trim() || 'Gold rate alert')
    setThresholdLink(data.rate_move_alert_link?.trim() || '/marketplace')
    setGoldImageUrl(data.gold_push_image_url ?? '')
    setHoldingGainInr(data.holding_gain_threshold_inr ?? '500')
    setMaxGoldAlertsDay(String(data.max_gold_alerts_per_day ?? 3))
    setPortfolioGainInr(data.portfolio_gain_threshold_inr ?? '500')
    setPortfolioGainPct(data.portfolio_gain_threshold_percent ?? '2')
    const ext = data as GoldAlertSettings & {
      active_engagement_context?: string
      active_festival_name?: string
      enable_educational_engagement?: boolean
    }
    setActiveEngagementContext(ext.active_engagement_context?.trim() || 'default')
    setActiveFestivalName(ext.active_festival_name?.trim() || '')
    setEnableEducational(Boolean(ext.enable_educational_engagement))
  }, [])

  useEffect(() => {
    void loadFestivals()
    void loadGoldSettings()
  }, [loadFestivals, loadGoldSettings])

  useEffect(() => {
    const t = window.setInterval(() => void loadFestivals(), 60000)
    return () => window.clearInterval(t)
  }, [loadFestivals])

  useEffect(() => {
    if (!scheduledLocal) {
      const d = new Date()
      d.setMinutes(d.getMinutes() + 5)
      d.setSeconds(0, 0)
      const pad = (n: number) => String(n).padStart(2, '0')
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      setScheduledLocal(local)
    }
  }, [scheduledLocal])

  const saveGoldSettings = async () => {
    setGoldSaveErr('')
    setGoldSaved('')
    setGoldBusy(true)
    try {
      const res = await authFetch('/api/v1/admin/gold-ticker/', {
        method: 'PATCH',
        jsonBody: {
          hourly_gold_push_enabled: hourlyEnabled,
          hourly_gold_push_title: hourlyTitle.trim() || 'Gold price update',
          hourly_gold_push_link: hourlyLink.trim() || '/marketplace',
          rate_move_alerts_enabled: thresholdEnabled,
          rate_move_alert_threshold_inr: thresholdInr.trim(),
          rate_move_alert_title: thresholdTitle.trim() || 'Gold rate alert',
          rate_move_alert_link: thresholdLink.trim() || '/marketplace',
          gold_push_image_url: goldImageUrl.trim(),
          holding_gain_threshold_inr: holdingGainInr.trim(),
          max_gold_alerts_per_day: Number.parseInt(maxGoldAlertsDay.trim(), 10) || 3,
          portfolio_gain_threshold_inr: portfolioGainInr.trim(),
          portfolio_gain_threshold_percent: portfolioGainPct.trim(),
          active_engagement_context: activeEngagementContext.trim() || 'default',
          active_festival_name: activeFestivalName.trim(),
          enable_educational_engagement: enableEducational,
        },
      })
      const data = (await res.json().catch(() => ({}))) as { detail?: string }
      if (!res.ok) {
        setGoldSaveErr(typeof data.detail === 'string' ? data.detail : `Save failed (${res.status}).`)
        return
      }
      setGoldSaved('Gold alert settings saved.')
      await loadGoldSettings()
    } finally {
      setGoldBusy(false)
    }
  }

  const sendGoldPriceNow = async () => {
    setSendPushMsg('')
    setSendPushBusy(true)
    try {
      const res = await authFetch('/api/v1/admin/gold-ticker/send-price-notification/', {
        method: 'POST',
        jsonBody: { use_live_price_line: true },
      })
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string
        body_preview?: string
        sent_broadcast?: number
        sent_inbox?: number
      }
      if (!res.ok) {
        setSendPushMsg(typeof data.detail === 'string' ? data.detail : `Send failed (${res.status}).`)
        return
      }
      setSendPushMsg(
        `Sent: ${data.sent_broadcast ?? 0} broadcast, ${data.sent_inbox ?? 0} customer inbox. Preview: ${data.body_preview ?? ''}`,
      )
    } finally {
      setSendPushBusy(false)
    }
  }

  const saveFestival = async () => {
    setSaveErr('')
    const b = body.trim()
    if (!b) {
      setSaveErr('Enter the message body.')
      return
    }
    if (!scheduledLocal.trim()) {
      setSaveErr('Choose a date and time.')
      return
    }
    const when = new Date(scheduledLocal)
    if (Number.isNaN(when.getTime())) {
      setSaveErr('Invalid date or time.')
      return
    }
    setBusy(true)
    try {
      const meta: Record<string, unknown> = {}
      if (
        (targetType === 'DEFAULT_JEWELLER_USERS' || targetType === 'SPECIFIC_JEWELLER_USERS') &&
        targetJewellerId.trim()
      ) {
        meta.jeweller_id = Number.parseInt(targetJewellerId.trim(), 10)
      }
      const res = await authFetch('/api/v1/admin/festival-broadcasts/', {
        method: 'POST',
        jsonBody: {
          title: title.trim() || 'Cridora',
          body: b,
          image_url: festImageUrl.trim(),
          scheduled_at: when.toISOString(),
          target_type: targetType,
          target_metadata: meta,
          engagement_context: festEngagementContext.trim(),
          engagement_moment: festEngagementMoment.trim(),
          festival_name: festFestivalName.trim(),
          personalize_per_user: festPersonalize,
        },
      })
      const data = (await res.json().catch(() => ({}))) as { detail?: string }
      if (!res.ok) {
        setSaveErr(typeof data.detail === 'string' ? data.detail : `Save failed (${res.status}).`)
        return
      }
      setBody('')
      setFestImageUrl('')
      await loadFestivals()
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (id: number) => {
    setCancelId(id)
    setSaveErr('')
    try {
      const res = await authFetch(`/api/v1/admin/festival-broadcasts/${id}/cancel/`, {
        method: 'POST',
        jsonBody: {},
      })
      const data = (await res.json().catch(() => ({}))) as { detail?: string }
      if (!res.ok) {
        setSaveErr(typeof data.detail === 'string' ? data.detail : `Cancel failed (${res.status}).`)
        return
      }
      await loadFestivals()
    } finally {
      setCancelId(null)
    }
  }

  return (
    <div className="dash-panel-max">
      {tab == null ? (
        <>
          <h2 className="dash-table-title">Pushes &amp; alerts</h2>
          <p className="dash-footnote" style={{ marginBottom: '1.25rem', maxWidth: 720 }}>
            Manage automated gold-rate alerts and scheduled festival broadcasts. All pushes go to devices that tapped{' '}
            <strong>Enable</strong> in the notification bell (Web Push + Android FCM). Reference price is the same public{' '}
            <strong>22K</strong> rate shown on the homepage ticker.
          </p>
        </>
      ) : null}

      {showGold ? (
        <>
      <h3 className="dash-table-title" style={{ fontSize: '1.05rem' }}>
        Automated gold alerts
      </h3>
      <p className="dash-footnote" style={{ marginBottom: '0.75rem', maxWidth: 720 }}>
        Live gold alerts are <strong>event-driven</strong> when the public 22K reference is ingested (spot refresh,
        ticker API, admin save) — do not schedule <code className="tabular">run_gold_rate_alerts</code> or{' '}
        <code className="tabular">run_hourly_gold_push</code> on Railway cron. Use cron only for housekeeping (see{' '}
        <code className="tabular">docs/RAILWAY_CRON.md</code>). Threshold moves send a public broadcast plus customer
        inbox for users with holdings (prefs + daily cap).
      </p>
      {goldLoadErr ? <p className="form-error">{goldLoadErr}</p> : null}
      <div className="card" style={{ maxWidth: 640, padding: '1.25rem', marginBottom: '1.5rem' }}>
        {goldSettings ? (
          <p className="dash-footnote" style={{ marginTop: 0, marginBottom: '1rem' }}>
            Live public 22K: <strong className="tabular">₹{goldSettings.platform_base_inr_per_gram_22k}</strong>
            {goldSettings.rate_alert_baseline_inr_per_gram_22k ? (
              <>
                {' '}
                · threshold baseline <strong className="tabular">{goldSettings.rate_alert_baseline_inr_per_gram_22k}</strong>
              </>
            ) : null}
            {goldSettings.hourly_gold_push_baseline_inr_per_gram_22k ? (
              <>
                {' '}
                · hourly snapshot{' '}
                <strong className="tabular">{goldSettings.hourly_gold_push_baseline_inr_per_gram_22k}</strong>
              </>
            ) : null}
            {goldSettings.last_platform_rate_change ? (
              <>
                {' '}
                · last platform move{' '}
                <strong className="tabular">
                  ₹{goldSettings.last_platform_rate_change.previous_rate} → ₹
                  {goldSettings.last_platform_rate_change.new_rate}
                </strong>{' '}
                ({fmtWhen(goldSettings.last_platform_rate_change.created_at)})
              </>
            ) : null}
          </p>
        ) : null}

        <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={hourlyEnabled}
            onChange={(e) => setHourlyEnabled(e.target.checked)}
            style={{ marginTop: '0.2rem' }}
          />
          <span style={{ fontSize: '0.85rem', lineHeight: 1.45 }}>
            <strong>Hourly digest</strong> — each hour, notify subscribers when the public 22K reference changed vs the
            prior hour (first run stores baseline only).
          </span>
        </label>
        <div className="field" style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="hourly-title">Hourly notification title</label>
          <input id="hourly-title" value={hourlyTitle} onChange={(e) => setHourlyTitle(e.target.value)} maxLength={120} />
        </div>
        <div className="field" style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="hourly-link">Hourly tap opens (path)</label>
          <input id="hourly-link" value={hourlyLink} onChange={(e) => setHourlyLink(e.target.value)} placeholder="/marketplace" />
        </div>

        <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={thresholdEnabled}
            onChange={(e) => setThresholdEnabled(e.target.checked)}
            style={{ marginTop: '0.2rem' }}
          />
          <span style={{ fontSize: '0.85rem', lineHeight: 1.45 }}>
            <strong>Threshold alert</strong> — notify when public 22K moves up or down by at least the ₹ amount below (vs
            previous baseline).
          </span>
        </label>
        <div className="field" style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="threshold-inr">Minimum move (₹/g)</label>
          <input
            id="threshold-inr"
            type="text"
            inputMode="decimal"
            value={thresholdInr}
            onChange={(e) => setThresholdInr(e.target.value)}
            placeholder="10"
          />
        </div>
        <div className="field" style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="threshold-title">Threshold notification title</label>
          <input id="threshold-title" value={thresholdTitle} onChange={(e) => setThresholdTitle(e.target.value)} maxLength={120} />
        </div>
        <div className="field" style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="threshold-link">Threshold tap opens (path)</label>
          <input id="threshold-link" value={thresholdLink} onChange={(e) => setThresholdLink(e.target.value)} placeholder="/marketplace" />
        </div>

        <div className="field" style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="holding-gain-inr">Per-holding gain threshold (₹)</label>
          <input
            id="holding-gain-inr"
            type="text"
            inputMode="decimal"
            value={holdingGainInr}
            onChange={(e) => setHoldingGainInr(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="max-gold-alerts">Max gold/holding alerts per customer per day</label>
          <input
            id="max-gold-alerts"
            type="number"
            min={1}
            max={20}
            value={maxGoldAlertsDay}
            onChange={(e) => setMaxGoldAlertsDay(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="portfolio-gain-inr">Portfolio gain threshold (₹)</label>
          <input
            id="portfolio-gain-inr"
            type="text"
            inputMode="decimal"
            value={portfolioGainInr}
            onChange={(e) => setPortfolioGainInr(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label htmlFor="portfolio-gain-pct">Portfolio gain threshold (%)</label>
          <input
            id="portfolio-gain-pct"
            type="text"
            inputMode="decimal"
            value={portfolioGainPct}
            onChange={(e) => setPortfolioGainPct(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label htmlFor="active-engagement-context">Active engagement context (ingest)</label>
          <select
            id="active-engagement-context"
            value={activeEngagementContext}
            onChange={(e) => setActiveEngagementContext(e.target.value)}
          >
            <option value="default">default</option>
            <option value="festival">festival</option>
            <option value="educational">educational</option>
          </select>
        </div>
        {activeEngagementContext === 'festival' ? (
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label htmlFor="active-festival-name">Festival name (for templates)</label>
            <input
              id="active-festival-name"
              type="text"
              value={activeFestivalName}
              onChange={(e) => setActiveFestivalName(e.target.value)}
              placeholder="Vishu, Onam, …"
            />
          </div>
        ) : null}
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>
            <input
              type="checkbox"
              checked={enableEducational}
              onChange={(e) => setEnableEducational(e.target.checked)}
            />{' '}
            Educational market awareness on ingest (monthly cap per user)
          </label>
        </div>

        <div className="field" style={{ marginBottom: '1rem' }}>
          <label htmlFor="gold-image">Image for gold alerts (optional HTTPS URL)</label>
          <input
            id="gold-image"
            type="url"
            value={goldImageUrl}
            onChange={(e) => setGoldImageUrl(e.target.value)}
            placeholder="https://…/gold-alert.png"
          />
          <span className="dash-footnote" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.72rem' }}>
            Shown on Web Push and Android when supported. Use a public HTTPS image URL.
          </span>
        </div>

        {goldSaveErr ? <p className="form-error">{goldSaveErr}</p> : null}
        {goldSaved ? <p className="dash-footnote" style={{ color: 'var(--ok, #2ecc71)' }}>{goldSaved}</p> : null}
        {sendPushMsg ? <p className="dash-footnote" style={{ marginTop: '0.5rem' }}>{sendPushMsg}</p> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button type="button" className="btn btn-primary" disabled={goldBusy} onClick={() => void saveGoldSettings()}>
            {goldBusy ? 'Saving…' : 'Save gold alert settings'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={sendPushBusy}
            onClick={() => void sendGoldPriceNow()}
          >
            {sendPushBusy ? 'Sending…' : 'Send price notification now'}
          </button>
        </div>
        <p className="dash-footnote" style={{ marginTop: '0.65rem', fontSize: '0.72rem' }}>
          Manual send uses the live 22K line for broadcast and customer inbox; it does not change threshold baselines.
          Tray body is truncated to ~120 characters; image URL must be HTTPS.
        </p>
      </div>
        </>
      ) : null}

      {showCampaigns ? (
        <>
      <h3 className="dash-table-title" style={{ fontSize: '1.05rem' }}>
        Festival &amp; manual broadcasts
      </h3>
      <p className="dash-footnote" style={{ marginBottom: '0.75rem', maxWidth: 640 }}>
        Schedule a one-off message. Sends at the chosen time to all subscribed devices. Also runs when this page or the
        admin bell is open; use cron <code className="tabular">process_festival_broadcasts</code> every few minutes for
        reliability.
      </p>

      <div className="card" style={{ maxWidth: 560, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="field">
          <label htmlFor="fest-title">Title (optional)</label>
          <input
            id="fest-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Cridora"
            disabled={busy}
            maxLength={120}
          />
        </div>
        <div className="field">
          <label htmlFor="fest-target">Audience</label>
          <select
            id="fest-target"
            value={targetType}
            disabled={busy}
            onChange={(e) => setTargetType(e.target.value)}
          >
            <option value="ALL_USERS">All customers</option>
            <option value="ALL_APP_INSTALLS">All push subscribers</option>
            <option value="DEFAULT_JEWELLER_USERS">Default jeweller customers</option>
            <option value="SPECIFIC_JEWELLER_USERS">Jeweller customers (purchases)</option>
          </select>
        </div>
        {(targetType === 'DEFAULT_JEWELLER_USERS' || targetType === 'SPECIFIC_JEWELLER_USERS') ? (
          <div className="field">
            <label htmlFor="fest-jeweller-id">Jeweller user ID</label>
            <input
              id="fest-jeweller-id"
              type="number"
              value={targetJewellerId}
              disabled={busy}
              onChange={(e) => setTargetJewellerId(e.target.value)}
              placeholder="Numeric jeweller account ID"
            />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="fest-ctx">Engagement context (optional)</label>
          <input
            id="fest-ctx"
            type="text"
            value={festEngagementContext}
            disabled={busy}
            onChange={(e) => setFestEngagementContext(e.target.value)}
            placeholder="festival, jeweller_campaign, or blank for static body"
          />
        </div>
        <div className="field">
          <label htmlFor="fest-moment">Engagement moment (with personalize)</label>
          <input
            id="fest-moment"
            type="text"
            value={festEngagementMoment}
            disabled={busy}
            onChange={(e) => setFestEngagementMoment(e.target.value)}
            placeholder="holding_appreciation, portfolio_growth, …"
          />
        </div>
        <div className="field">
          <label htmlFor="fest-name">Festival name (for {'{{festival_name}}'})</label>
          <input
            id="fest-name"
            type="text"
            value={festFestivalName}
            disabled={busy}
            onChange={(e) => setFestFestivalName(e.target.value)}
            placeholder="Vishu, Onam, …"
          />
        </div>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={festPersonalize}
              disabled={busy}
              onChange={(e) => setFestPersonalize(e.target.checked)}
            />{' '}
            Personalize per user (template + facts)
          </label>
        </div>
        <div className="field">
          <label htmlFor="fest-body">Message</label>
          <textarea
            id="fest-body"
            className="dash-textarea"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={busy}
            placeholder="e.g. Happy Diwali — vaults stay open; rates refresh live in the marketplace."
            maxLength={2000}
          />
        </div>
        <div className="field">
          <label htmlFor="fest-image">Image URL (optional HTTPS)</label>
          <input
            id="fest-image"
            type="url"
            value={festImageUrl}
            onChange={(e) => setFestImageUrl(e.target.value)}
            disabled={busy}
            placeholder="https://…/festival-banner.jpg"
          />
        </div>
        <div className="field">
          <label htmlFor="fest-when">Send at (your device local time)</label>
          <input
            id="fest-when"
            type="datetime-local"
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.target.value)}
            disabled={busy}
          />
        </div>
        {saveErr ? <p className="form-error">{saveErr}</p> : null}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveFestival()}>
          {busy ? 'Saving…' : 'Save schedule'}
        </button>
      </div>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <h3 className="dash-table-title" style={{ fontSize: '1.05rem' }}>
        Recent schedules
      </h3>
      <div className="dash-table-scroll card">
        <table className="admin-user-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Title</th>
              <th>Preview</th>
              <th>Status</th>
              <th>Devices</th>
              <th>By</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: 'var(--text-muted)', padding: '1.25rem' }}>
                  No broadcasts yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="tabular">{fmtWhen(r.scheduled_at)}</td>
                  <td>{r.title}</td>
                  <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.body}
                    {r.image_url ? ' 🖼' : ''}
                  </td>
                  <td>
                    <span className={`kyb-pill kyb-pill--${statusTone(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="tabular">{r.push_recipient_count != null ? r.push_recipient_count : '—'}</td>
                  <td style={{ fontSize: '0.85rem' }}>{r.created_by_email}</td>
                  <td>
                    {r.status === 'pending' ? (
                      <button
                        type="button"
                        className="btn btn-ghost kyb-btn-sm"
                        disabled={cancelId === r.id}
                        onClick={() => void cancel(r.id)}
                      >
                        {cancelId === r.id ? '…' : 'Cancel'}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
        </>
      ) : null}
    </div>
  )
}
