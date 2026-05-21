import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { AdminFractionalMarkupPanel } from '@/features/admin/AdminFractionalMarkupPanel'

export function AdminFractionalOtpPolicyPanel() {
  const [otpSeconds, setOtpSeconds] = useState<number | null>(null)
  const [otpDraft, setOtpDraft] = useState('')
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
      setOtpSeconds(null)
      setLoadErr(data.detail != null ? String(data.detail) : 'Could not load fractional OTP policy.')
      return
    }
    const s = data.fractional_counter_otp_ttl_seconds
    if (typeof s !== 'number' || !Number.isFinite(s)) {
      setLoadErr('Unexpected response.')
      setOtpSeconds(null)
      return
    }
    setOtpSeconds(s)
    setOtpDraft(String(s))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaveErr('')
    const n = Number.parseInt(otpDraft.trim(), 10)
    if (!Number.isFinite(n)) {
      setSaveErr('Enter a whole number of seconds for OTP TTL.')
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
        setOtpSeconds(s)
        setOtpDraft(String(s))
      }
    } finally {
      setBusy(false)
    }
  }

  const mins = otpSeconds != null ? (otpSeconds / 60).toFixed(2) : null

  return (
    <div className="dash-panel-max">
      <h2 className="dash-table-title">Fractional investment policy</h2>

      <div style={{ marginBottom: '1.25rem' }}>
        <AdminFractionalMarkupPanel />
      </div>

      <div className="card" style={{ maxWidth: 560, padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Counter OTP validity</h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Customers see a live countdown on their verification code. When it hits zero they must generate a new OTP.
          Allowed range: <strong>60 seconds</strong> (1 minute) through <strong>86400 seconds</strong> (24 hours).
        </p>

        {loadErr ? <p className="form-error">{loadErr}</p> : null}

        {otpSeconds != null ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Current TTL: <strong className="tabular">{otpSeconds}</strong> seconds (~{mins} min).
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="admin-otp-ttl">OTP TTL (seconds)</label>
          <input
            id="admin-otp-ttl"
            type="text"
            inputMode="numeric"
            value={otpDraft}
            onChange={(e) => setOtpDraft(e.target.value)}
            disabled={busy || otpSeconds == null}
          />
        </div>

        {saveErr ? <p className="form-error">{saveErr}</p> : null}

        <button type="button" className="btn btn-primary" disabled={busy || otpSeconds == null} onClick={() => void save()}>
          Save OTP policy
        </button>
      </div>
    </div>
  )
}
