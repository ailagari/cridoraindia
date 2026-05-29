import { useCallback, useEffect, useState } from 'react'
import {
  fetchWebPushServerStatus,
  getBrowserPushActive,
  pushNotificationsSupported,
  registerWebPushSubscription,
} from '@/lib/webPushApi'
import {
  fetchInboxPreferences,
  patchInboxPreferences,
  type NotificationPreferencesDTO,
} from '@/lib/inboxApi'

type Props = {
  title?: string
  description?: string
}

export function NotificationSettingsPanel({
  title = 'Notifications',
  description = 'Choose which alerts you receive and how they are delivered.',
}: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferencesDTO | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [pushActive, setPushActive] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushErr, setPushErr] = useState('')
  const [serverReady, setServerReady] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    setLoadErr('')
    const out = await fetchInboxPreferences()
    if (!out.ok) {
      setLoadErr(out.detail)
      return
    }
    setPrefs(out.data)
  }, [])

  useEffect(() => {
    void load()
    void fetchWebPushServerStatus().then((s) => setServerReady(s.configured))
    if (pushNotificationsSupported()) {
      void getBrowserPushActive().then(setPushActive)
    }
  }, [load])

  const saveToggle = async (key: keyof NotificationPreferencesDTO, value: boolean) => {
    if (!prefs) return
    setBusy(true)
    setSaveMsg('')
    const out = await patchInboxPreferences({ [key]: value })
    setBusy(false)
    if (!out.ok) {
      setLoadErr(out.detail)
      return
    }
    setPrefs(out.data)
    setSaveMsg('Saved.')
  }

  const enablePush = async () => {
    setPushBusy(true)
    setPushErr('')
    try {
      await registerWebPushSubscription()
      setPushActive(true)
    } catch (e) {
      setPushErr(e instanceof Error ? e.message : 'Could not enable push.')
    } finally {
      setPushBusy(false)
    }
  }

  if (loadErr && !prefs) {
    return (
      <div className="card dash-panel-max">
        <p className="form-error">{loadErr}</p>
      </div>
    )
  }

  if (!prefs) {
    return (
      <div className="card dash-panel-max">
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading notification settings…</p>
      </div>
    )
  }

  const toggles: { key: keyof NotificationPreferencesDTO; label: string; hint?: string }[] = [
    { key: 'allow_push_notifications', label: 'Push notifications', hint: 'Master switch for device alerts.' },
    { key: 'allow_portfolio_alerts', label: 'Portfolio & transactions' },
    { key: 'allow_gold_alerts', label: 'Gold rate movement' },
    { key: 'allow_jeweller_campaigns', label: 'Jeweller campaigns' },
    { key: 'allow_festival_alerts', label: 'Festival & seasonal messages' },
    { key: 'allow_promotional', label: 'Promotional offers' },
    { key: 'allow_sound', label: 'Notification sound' },
  ]

  return (
    <div className="dash-panel-max" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card">
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          {title}
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '1rem' }}>
          {description}
        </p>
        <p className="dash-coming__text" style={{ fontSize: '0.9rem' }}>
          Security and OTP alerts cannot be turned off.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Push delivery</h3>
        {serverReady === false ? (
          <p className="form-error">Push is not configured on this server.</p>
        ) : pushActive ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Push is enabled on this device.</p>
        ) : pushNotificationsSupported() ? (
          <button type="button" className="btn btn-primary" disabled={pushBusy} onClick={() => void enablePush()}>
            {pushBusy ? 'Enabling…' : 'Enable push on this device'}
          </button>
        ) : (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Push is not supported in this browser.</p>
        )}
        {pushErr ? <p className="form-error">{pushErr}</p> : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Alert types</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {toggles.map((row) => (
            <li key={row.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ flex: '1 1 12rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(prefs[row.key])}
                  disabled={busy}
                  onChange={(e) => void saveToggle(row.key, e.target.checked)}
                />{' '}
                {row.label}
              </label>
              {row.hint ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flex: '1 1 100%' }}>{row.hint}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {saveMsg ? <p style={{ marginTop: '0.75rem', color: 'var(--ok)' }}>{saveMsg}</p> : null}
        {loadErr ? <p className="form-error">{loadErr}</p> : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Quiet hours</h3>
        <p className="dash-coming__text" style={{ marginBottom: '0.75rem' }}>
          Non-security alerts are paused during this window (Asia/Kolkata).
        </p>
        <div className="field">
          <label htmlFor="quiet-start">Start</label>
          <input
            id="quiet-start"
            type="time"
            value={prefs.quiet_hours_start?.slice(0, 5) ?? ''}
            disabled={busy}
            onChange={(e) => void patchInboxPreferences({ quiet_hours_start: e.target.value || null }).then((o) => o.ok && setPrefs(o.data))}
          />
        </div>
        <div className="field">
          <label htmlFor="quiet-end">End</label>
          <input
            id="quiet-end"
            type="time"
            value={prefs.quiet_hours_end?.slice(0, 5) ?? ''}
            disabled={busy}
            onChange={(e) => void patchInboxPreferences({ quiet_hours_end: e.target.value || null }).then((o) => o.ok && setPrefs(o.data))}
          />
        </div>
      </div>
    </div>
  )
}
