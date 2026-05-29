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
        Schedule cron on Railway: <code className="tabular">run_hourly_gold_push</code> every hour and{' '}
        <code className="tabular">run_gold_rate_alerts</code> every 1–5 minutes for reliable delivery.
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
        <button type="button" className="btn btn-primary" disabled={goldBusy} onClick={() => void saveGoldSettings()}>
          {goldBusy ? 'Saving…' : 'Save gold alert settings'}
        </button>
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
