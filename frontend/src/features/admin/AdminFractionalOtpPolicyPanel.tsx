import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

type PolicyState = {
  otpSeconds: number
  markupPercent: string
}

export function AdminFractionalOtpPolicyPanel() {
  const [policy, setPolicy] = useState<PolicyState | null>(null)
  const [otpDraft, setOtpDraft] = useState('')
  const [markupDraft, setMarkupDraft] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoadErr('')
    const res = await authFetch('/api/v1/admin/fractional-counter-otp-policy/')
    const data = (await res.json().catch(() => ({}))) as {
      fractional_counter_otp_ttl_seconds?: number
      fractional_markup_percent?: string
      detail?: string
    }
    if (!res.ok) {
      setPolicy(null)
      setLoadErr(data.detail != null ? String(data.detail) : 'Could not load fractional policy.')
      return
    }
    const s = data.fractional_counter_otp_ttl_seconds
    const markup = data.fractional_markup_percent
    if (typeof s !== 'number' || !Number.isFinite(s) || typeof markup !== 'string') {
      setLoadErr('Unexpected response.')
      setPolicy(null)
      return
    }
    setPolicy({ otpSeconds: s, markupPercent: markup })
    setOtpDraft(String(s))
    setMarkupDraft(markup)
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
    const markupNum = Number.parseFloat(markupDraft.trim())
    if (!Number.isFinite(markupNum)) {
      setSaveErr('Enter a valid markup percentage.')
      return
    }
    setBusy(true)
    try {
      const res = await authFetch('/api/v1/admin/fractional-counter-otp-policy/', {
        method: 'PATCH',
        jsonBody: {
          fractional_counter_otp_ttl_seconds: n,
          fractional_markup_percent: markupDraft.trim(),
        },
      })
      const data = (await res.json().catch(() => ({}))) as {
        fractional_counter_otp_ttl_seconds?: number
        fractional_markup_percent?: string
        detail?: string
      }
      if (!res.ok) {
        setSaveErr(data.detail != null ? String(data.detail) : 'Save failed.')
        return
      }
      const s = data.fractional_counter_otp_ttl_seconds
      const markup = data.fractional_markup_percent
      if (typeof s === 'number' && Number.isFinite(s) && typeof markup === 'string') {
        setPolicy({ otpSeconds: s, markupPercent: markup })
        setOtpDraft(String(s))
        setMarkupDraft(markup)
      }
    } finally {
      setBusy(false)
    }
  }

  const mins = policy != null ? (policy.otpSeconds / 60).toFixed(2) : null

  return (
    <div className="dash-panel-max">
      <h2 className="dash-table-title">Fractional investment policy</h2>

      <div className="card" style={{ maxWidth: 480, padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Platform markup</h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Added on top of each jeweller&apos;s board rate when customers quote or buy fractional gold.
          Allowed range: <strong>0%</strong> through <strong>100%</strong>.
        </p>

        {policy != null ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Current markup: <strong className="tabular">{policy.markupPercent}%</strong>
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="admin-fractional-markup">Markup (%)</label>
          <input
            id="admin-fractional-markup"
            type="text"
            inputMode="decimal"
            value={markupDraft}
            onChange={(e) => setMarkupDraft(e.target.value)}
            disabled={busy || policy == null}
          />
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480, padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Counter OTP validity</h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Customers see a live countdown on their verification code. When it hits zero they must generate a new OTP.
          Allowed range: <strong>60 seconds</strong> (1 minute) through <strong>86400 seconds</strong> (24 hours).
        </p>

        {loadErr ? <p className="form-error">{loadErr}</p> : null}

        {policy != null ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Current TTL: <strong className="tabular">{policy.otpSeconds}</strong> seconds (~{mins} min).
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
            disabled={busy || policy == null}
          />
        </div>

        {saveErr ? <p className="form-error">{saveErr}</p> : null}

        <button type="button" className="btn btn-primary" disabled={busy || policy == null} onClick={() => void save()}>
          Save policy
        </button>
      </div>
    </div>
  )
}
