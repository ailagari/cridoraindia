import { useCallback, useEffect, useState } from 'react'
import {
  jewellerFractionalPending,
  jewellerFractionalVerify,
  type JewellerFractionalPendingRow,
} from '@/lib/fractionalPurchaseApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function JewellerFractionalVerifyPanel() {
  const [rows, setRows] = useState<JewellerFractionalPendingRow[]>([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [otpByOrderId, setOtpByOrderId] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    setErr('')
    setRows(await jewellerFractionalPending())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyId == null)

  const verify = async (id: number) => {
    const otp = (otpByOrderId[id] ?? '').trim()
    if (!otp) {
      setErr('Enter the OTP from the customer’s app.')
      return
    }
    setBusyId(id)
    setErr('')
    setMsg('')
    try {
      const out = await jewellerFractionalVerify(id, otp)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setMsg(`Order ${out.data.reference} verified — customer credited ${out.data.grams} g. Matching custodial liability recorded.`)
      setOtpByOrderId((m) => {
        const next = { ...m }
        delete next[id]
        return next
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        When a customer pays at your counter, they generate a <strong>6-digit OTP</strong> in their Cridora app after paying.
        Enter that code below — when it matches, their gold is credited and a matching <strong>custodial liability</strong> is
        recorded on your ledger.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh queue
        </button>
      </div>
      {err ? <p className="form-error">{err}</p> : null}
      {msg ? <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{msg}</p> : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No counter payments awaiting OTP verification.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', maxWidth: 640 }}>
          {rows.map((r) => (
            <div key={r.id} className="card" style={{ padding: '1.1rem' }}>
              <p style={{ margin: '0 0 0.35rem', fontWeight: 800, fontSize: '1rem' }}>
                {r.customer.name || r.customer.email}
              </p>
              <p style={{ margin: '0 0 0.65rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                {r.customer.email}
              </p>
              {r.customer.cridora_member_id ? (
                <p style={{ margin: '0 0 0.65rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Member ID <strong className="tabular">{r.customer.cridora_member_id}</strong>
                </p>
              ) : null}
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <span className="tabular" style={{ color: 'var(--text)', fontWeight: 700 }}>
                  {r.grams} g
                </span>
                <span aria-hidden="true"> · </span>
                <span className="tabular" style={{ color: 'var(--text)', fontWeight: 700 }}>
                  ₹{formatInr(r.total_inr)}
                </span>
                <span> total (incl. GST)</span>
              </p>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Order <strong>{r.reference}</strong> · rate ₹{formatInr(r.metal_rate_inr_per_gram)}/g (22K metal)
              </p>
              {r.customer_note ? (
                <p style={{ margin: '0.35rem 0', fontSize: '0.8rem' }}>Note: {r.customer_note}</p>
              ) : null}
              <label className="field" htmlFor={`otp-${r.id}`} style={{ marginTop: '0.65rem', display: 'block' }}>
                Customer OTP
              </label>
              <input
                id={`otp-${r.id}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                className="tabular"
                style={{ width: '100%', maxWidth: 220, letterSpacing: '0.12em', fontWeight: 700 }}
                value={otpByOrderId[r.id] ?? ''}
                onChange={(e) =>
                  setOtpByOrderId((m) => ({
                    ...m,
                    [r.id]: e.target.value.replace(/\D/g, '').slice(0, 6),
                  }))
                }
                placeholder="000000"
              />
              <button
                type="button"
                className="btn btn-primary btn--block"
                style={{ marginTop: '0.75rem' }}
                disabled={busyId != null}
                onClick={() => void verify(r.id)}
              >
                {busyId === r.id ? 'Verifying…' : 'Verify OTP & credit gold'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
