import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

type GoldAlertSettings = {
  platform_base_inr_per_gram_22k: string
  rate_move_alert_threshold_inr: string
  rate_move_alerts_enabled: boolean
  hourly_gold_push_enabled: boolean
  hourly_gold_push_title: string
  rate_move_alert_title: string
  gold_push_image_url: string
  holding_gain_threshold_inr?: string
  max_gold_alerts_per_day?: number
  portfolio_gain_threshold_inr?: string
  portfolio_gain_threshold_percent?: string
  last_platform_rate_change?: {
    previous_rate: string
    new_rate: string
    created_at: string
  } | null
}

export function AdminGoldAlertsPanel() {
  const [settings, setSettings] = useState<GoldAlertSettings | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendBusy, setSendBusy] = useState(false)
  const [sendMsg, setSendMsg] = useState('')

  const [hourlyOn, setHourlyOn] = useState(true)
  const [thresholdOn, setThresholdOn] = useState(true)
  const [thresholdInr, setThresholdInr] = useState('10')
  const [hourlyTitle, setHourlyTitle] = useState('Gold price update')
  const [thresholdTitle, setThresholdTitle] = useState('Gold rate alert')
  const [goldImage, setGoldImage] = useState('')
  const [holdingGain, setHoldingGain] = useState('500')
  const [maxPerDay, setMaxPerDay] = useState('3')
  const [portfolioInr, setPortfolioInr] = useState('500')
  const [portfolioPct, setPortfolioPct] = useState('2')

  const load = useCallback(async () => {
    setLoadErr('')
    const res = await authFetch('/api/v1/admin/gold-ticker/')
    const data = (await res.json().catch(() => ({}))) as GoldAlertSettings & { detail?: string }
    if (!res.ok) {
      setSettings(null)
      setLoadErr(data.detail != null ? String(data.detail) : 'Could not load settings.')
      return
    }
    setSettings(data)
    setHourlyOn(data.hourly_gold_push_enabled !== false)
    setThresholdOn(data.rate_move_alerts_enabled !== false)
    setThresholdInr(data.rate_move_alert_threshold_inr ?? '10')
    setHourlyTitle(data.hourly_gold_push_title?.trim() || 'Gold price update')
    setThresholdTitle(data.rate_move_alert_title?.trim() || 'Gold rate alert')
    setGoldImage(data.gold_push_image_url ?? '')
    setHoldingGain(data.holding_gain_threshold_inr ?? '500')
    setMaxPerDay(String(data.max_gold_alerts_per_day ?? 3))
    setPortfolioInr(data.portfolio_gain_threshold_inr ?? '500')
    setPortfolioPct(data.portfolio_gain_threshold_percent ?? '2')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaveErr('')
    setSaved('')
    setBusy(true)
    try {
      const res = await authFetch('/api/v1/admin/gold-ticker/', {
        method: 'PATCH',
        jsonBody: {
          hourly_gold_push_enabled: hourlyOn,
          hourly_gold_push_title: hourlyTitle.trim() || 'Gold price update',
          hourly_gold_push_link: '/marketplace',
          rate_move_alerts_enabled: thresholdOn,
          rate_move_alert_threshold_inr: thresholdInr.trim(),
          rate_move_alert_title: thresholdTitle.trim() || 'Gold rate alert',
          rate_move_alert_link: '/marketplace',
          gold_push_image_url: goldImage.trim(),
          holding_gain_threshold_inr: holdingGain.trim(),
          max_gold_alerts_per_day: Number.parseInt(maxPerDay.trim(), 10) || 3,
          portfolio_gain_threshold_inr: portfolioInr.trim(),
          portfolio_gain_threshold_percent: portfolioPct.trim(),
        },
      })
      const data = (await res.json().catch(() => ({}))) as { detail?: string }
      if (!res.ok) {
        setSaveErr(typeof data.detail === 'string' ? data.detail : `Save failed (${res.status}).`)
        return
      }
      setSaved('Gold alert settings saved.')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const sendNow = async () => {
    setSendMsg('')
    setSendBusy(true)
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
        setSendMsg(typeof data.detail === 'string' ? data.detail : 'Send failed.')
        return
      }
      setSendMsg(
        `Sent to ${data.sent_broadcast ?? 0} devices, ${data.sent_inbox ?? 0} customer inboxes. ${data.body_preview ?? ''}`,
      )
    } finally {
      setSendBusy(false)
    }
  }

  return (
    <div className="dash-panel-max">
      <div className="card">
        <h3 className="dash-coming__title" style={{ marginTop: 0 }}>
          Automatic gold alerts
        </h3>
        <p className="dash-coming__text" style={{ maxWidth: 640, marginBottom: '1rem' }}>
          These alerts fire automatically when the public 22K gold reference changes. They use the
          same rate shown on the homepage ticker. Keep copy factual and short.
        </p>
        {loadErr ? <p className="form-error">{loadErr}</p> : null}
        {settings ? (
          <p className="dash-footnote" style={{ marginBottom: '1rem' }}>
            Live 22K reference: <strong>₹{settings.platform_base_inr_per_gram_22k}</strong>
            {settings.last_platform_rate_change ? (
              <>
                {' '}
                · Last move ₹{settings.last_platform_rate_change.previous_rate} → ₹
                {settings.last_platform_rate_change.new_rate}
              </>
            ) : null}
          </p>
        ) : null}

        <label style={{ display: 'flex', gap: '0.65rem', marginBottom: '1rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={thresholdOn} onChange={(e) => setThresholdOn(e.target.checked)} />
          <span>
            <strong>Big move alert</strong> — notify when price moves at least ₹
            <input
              type="text"
              inputMode="decimal"
              value={thresholdInr}
              onChange={(e) => setThresholdInr(e.target.value)}
              style={{ width: '4rem', margin: '0 0.25rem' }}
            />
            /g vs last baseline
          </span>
        </label>
        <div className="field">
          <label htmlFor="g-th-title">Big move title</label>
          <input id="g-th-title" value={thresholdTitle} onChange={(e) => setThresholdTitle(e.target.value)} />
        </div>

        <label style={{ display: 'flex', gap: '0.65rem', margin: '1rem 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={hourlyOn} onChange={(e) => setHourlyOn(e.target.checked)} />
          <span>
            <strong>Hourly summary</strong> — if price changed since the last hour, send one digest
          </span>
        </label>
        <div className="field">
          <label htmlFor="g-hr-title">Hourly title</label>
          <input id="g-hr-title" value={hourlyTitle} onChange={(e) => setHourlyTitle(e.target.value)} />
        </div>

        <h4 style={{ marginTop: '1.25rem' }}>Customer holding alerts</h4>
        <div className="field">
          <label htmlFor="g-hold">Notify when one holding gains at least (₹)</label>
          <input id="g-hold" value={holdingGain} onChange={(e) => setHoldingGain(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="g-port-inr">Whole portfolio gain threshold (₹)</label>
          <input id="g-port-inr" value={portfolioInr} onChange={(e) => setPortfolioInr(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="g-port-pct">Portfolio gain threshold (%)</label>
          <input id="g-port-pct" value={portfolioPct} onChange={(e) => setPortfolioPct(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="g-cap">Max gold alerts per customer per day</label>
          <input
            id="g-cap"
            type="number"
            min={1}
            max={20}
            value={maxPerDay}
            onChange={(e) => setMaxPerDay(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="g-img">Alert image URL (optional)</label>
          <input id="g-img" type="url" value={goldImage} onChange={(e) => setGoldImage(e.target.value)} />
        </div>

        {saveErr ? <p className="form-error">{saveErr}</p> : null}
        {saved ? <p style={{ color: 'var(--ok)' }}>{saved}</p> : null}
        {sendMsg ? <p className="dash-footnote">{sendMsg}</p> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={sendBusy} onClick={() => void sendNow()}>
            {sendBusy ? 'Sending…' : 'Send gold update now (test)'}
          </button>
        </div>
      </div>
    </div>
  )
}
