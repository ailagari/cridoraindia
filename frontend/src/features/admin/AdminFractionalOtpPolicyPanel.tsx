import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

export function AdminFractionalOtpPolicyPanel() {
  const [seconds, setSeconds] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoadErr('')
    const res = await authFetch('/api/v1/admin/fractional-counter-otp-policy/')
    const data = (await res.json().catch(() => ({}))) as {
      fractional_counter_otp_ttl_seconds?: number
      detail?: string
    }
    if (!res.ok) {
      setSeconds(null)
      setLoadErr(data.detail != null ? String(data.detail) : 'Could not load OTP policy.')
      return
    }
    const s = data.fractional_counter_otp_ttl_seconds
    if (typeof s !== 'number' || !Number.isFinite(s)) {
      setLoadErr('Unexpected response.')
      setSeconds(null)
      return
    }
    setSeconds(s)
    setDraft(String(s))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaveErr('')
    const n = Number.parseInt(draft.trim(), 10)
    if (!Number.isFinite(n)) {
      setSaveErr('Enter a whole number of seconds.')
      return
    }
    setBusy(true)
    try {
      const res = await authFetch('/api/v1/admin/fractional-counter-otp-policy/', {
        method: 'PATCH',
        jsonBody: { fractional_counter_otp_ttl_seconds: n },
      })
      const data = (await res.json().catch(() => ({}))) as {
        fractional_counter_otp_ttl_seconds?: number
        detail?: string
      }
      if (!res.ok) {
        setSaveErr(data.detail != null ? String(data.detail) : 'Save failed.')
        return
      }
      const s = data.fractional_counter_otp_ttl_seconds
      if (typeof s === 'number' && Number.isFinite(s)) {
        setSeconds(s)
        setDraft(String(s))
      }
    } finally {
      setBusy(false)
    }
  }

  const mins = seconds != null ? (seconds / 60).toFixed(2) : null

  return (
    <div className="dash-panel-max">
      <h2 className="dash-table-title">Counter OTP validity</h2>
      <div className="card" style={{ maxWidth: 480, padding: '1.25rem' }}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Customers see a live countdown on their verification code. When it hits zero they must generate a new OTP.
          Allowed range: <strong>60 seconds</strong> (1 minute) through <strong>86400 seconds</strong> (24 hours).
        </p>

        {loadErr ? <p className="form-error">{loadErr}</p> : null}

        {seconds != null ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Current TTL: <strong className="tabular">{seconds}</strong> seconds (~{mins} min).
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="admin-otp-ttl">OTP TTL (seconds)</label>
          <input
            id="admin-otp-ttl"
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy || seconds == null}
          />
        </div>

        {saveErr ? <p className="form-error">{saveErr}</p> : null}

        <button type="button" className="btn btn-primary" disabled={busy || seconds == null} onClick={() => void save()}>
          Save policy
        </button>
      </div>
    </div>
  )
}
