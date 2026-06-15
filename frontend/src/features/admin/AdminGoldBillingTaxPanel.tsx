import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { clearPlatformBillingTaxCache } from '@/lib/platformBillingTax'

export function AdminGoldBillingTaxPanel() {
  const [goldPercent, setGoldPercent] = useState<string | null>(null)
  const [makingPercent, setMakingPercent] = useState<string | null>(null)
  const [goldDraft, setGoldDraft] = useState('')
  const [makingDraft, setMakingDraft] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoadErr('')
    const res = await authFetch('/api/v1/admin/fractional-counter-otp-policy/')
    const data = (await res.json().catch(() => ({}))) as {
      gst_on_gold_percent?: string
      gst_on_making_percent?: string
      detail?: string
    }
    if (!res.ok) {
      setGoldPercent(null)
      setMakingPercent(null)
      setLoadErr(data.detail != null ? String(data.detail) : 'Could not load GST billing rates.')
      return
    }
    const gold = data.gst_on_gold_percent ?? '3'
    const making = data.gst_on_making_percent ?? '18'
    setGoldPercent(gold)
    setMakingPercent(making)
    setGoldDraft(gold)
    setMakingDraft(making)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaveErr('')
    const goldNum = Number.parseFloat(goldDraft.trim())
    const makingNum = Number.parseFloat(makingDraft.trim())
    if (!Number.isFinite(goldNum) || !Number.isFinite(makingNum)) {
      setSaveErr('Enter valid GST percentages for gold and making charge.')
      return
    }
    setBusy(true)
    try {
      const res = await authFetch('/api/v1/admin/fractional-counter-otp-policy/', {
        method: 'PATCH',
        jsonBody: {
          gst_on_gold_percent: goldDraft.trim(),
          gst_on_making_percent: makingDraft.trim(),
        },
      })
      const data = (await res.json().catch(() => ({}))) as {
        gst_on_gold_percent?: string
        gst_on_making_percent?: string
        detail?: string
      }
      if (!res.ok) {
        setSaveErr(data.detail != null ? String(data.detail) : 'Save failed.')
        return
      }
      const gold = data.gst_on_gold_percent ?? goldDraft.trim()
      const making = data.gst_on_making_percent ?? makingDraft.trim()
      setGoldPercent(gold)
      setMakingPercent(making)
      setGoldDraft(gold)
      setMakingDraft(making)
      clearPlatformBillingTaxCache()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560, padding: '1.25rem' }}>
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Ornament GST rates</h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Platform-wide GST on gold metal and making charges. Used in marketplace checkout, fractional
        purchases, savings schemes, personal vault bill math, and the public gold calculator. Update
        when government policy changes. Allowed range: <strong>0%</strong> through <strong>100%</strong>.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      {goldPercent != null && makingPercent != null ? (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Current: gold <strong className="tabular">{goldPercent}%</strong> · making{' '}
          <strong className="tabular">{makingPercent}%</strong>
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="admin-gst-gold">GST on gold metal (%)</label>
        <input
          id="admin-gst-gold"
          type="text"
          inputMode="decimal"
          value={goldDraft}
          onChange={(e) => setGoldDraft(e.target.value)}
          disabled={busy || goldPercent == null}
        />
      </div>

      <div className="field">
        <label htmlFor="admin-gst-making">GST on making charge (%)</label>
        <input
          id="admin-gst-making"
          type="text"
          inputMode="decimal"
          value={makingDraft}
          onChange={(e) => setMakingDraft(e.target.value)}
          disabled={busy || makingPercent == null}
        />
      </div>

      {saveErr ? <p className="form-error">{saveErr}</p> : null}

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || goldPercent == null}
        onClick={() => void save()}
        style={{ marginTop: '0.75rem' }}
      >
        Save GST rates
      </button>
    </div>
  )
}
