import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

type AdminFractionalMarkupPanelProps = {
  compact?: boolean
}

export function AdminFractionalMarkupPanel({ compact = false }: AdminFractionalMarkupPanelProps) {
  const [markupPercent, setMarkupPercent] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoadErr('')
    const res = await authFetch('/api/v1/admin/fractional-counter-otp-policy/')
    const data = (await res.json().catch(() => ({}))) as {
      fractional_markup_percent?: string
      detail?: string
    }
    if (!res.ok) {
      setMarkupPercent(null)
      setLoadErr(data.detail != null ? String(data.detail) : 'Could not load fractional markup.')
      return
    }
    const markup = data.fractional_markup_percent ?? '0'
    setMarkupPercent(markup)
    setDraft(markup)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaveErr('')
    const markupNum = Number.parseFloat(draft.trim())
    if (!Number.isFinite(markupNum)) {
      setSaveErr('Enter a valid markup percentage.')
      return
    }
    setBusy(true)
    try {
      const res = await authFetch('/api/v1/admin/fractional-counter-otp-policy/', {
        method: 'PATCH',
        jsonBody: { fractional_markup_percent: draft.trim() },
      })
      const data = (await res.json().catch(() => ({}))) as {
        fractional_markup_percent?: string
        detail?: string
      }
      if (!res.ok) {
        setSaveErr(data.detail != null ? String(data.detail) : 'Save failed.')
        return
      }
      const markup = data.fractional_markup_percent ?? draft.trim()
      setMarkupPercent(markup)
      setDraft(markup)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={compact ? undefined : 'card'} style={compact ? undefined : { maxWidth: 560, padding: '1.25rem' }}>
      <h3 style={{ margin: compact ? '0 0 0.75rem' : '0 0 0.75rem', fontSize: compact ? '0.95rem' : '1rem' }}>
        Fractional investment markup
      </h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Applied on the Cridora ticker reference rate (Ticker &amp; fees) for fractional vault purchases. Customers see one
        live rate — this markup is included silently, not shown as a separate spread.
        Allowed range: <strong>0%</strong> through <strong>100%</strong>.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      {markupPercent != null ? (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Current markup: <strong className="tabular">{markupPercent}%</strong>
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="admin-fractional-markup">Markup (%)</label>
        <input
          id="admin-fractional-markup"
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy || markupPercent == null}
        />
      </div>

      {saveErr ? <p className="form-error">{saveErr}</p> : null}

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || markupPercent == null}
        onClick={() => void save()}
        style={{ marginTop: '0.75rem' }}
      >
        Save markup
      </button>
    </div>
  )
}
