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

  const load = useCallback(async () => {
    setErr('')
    setRows(await jewellerFractionalPending())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyId == null)

  const verify = async (id: number) => {
    setBusyId(id)
    setErr('')
    setMsg('')
    try {
      const out = await jewellerFractionalVerify(id)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setMsg(`Order ${out.data.reference} verified — customer credited ${out.data.grams} g.`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Customers who chose <strong>pay at counter</strong> appear here after they place an order. Confirm cash or offline
        payment received at your showroom, then gold is credited to their Cridora wallet.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh queue
        </button>
      </div>
      {err ? <p className="form-error">{err}</p> : null}
      {msg ? <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{msg}</p> : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No counter payments awaiting verification.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', maxWidth: 640 }}>
          {rows.map((r) => (
            <div key={r.id} className="card" style={{ padding: '1.1rem' }}>
              <p style={{ margin: '0 0 0.35rem', fontWeight: 800 }}>
                {r.reference} · <span className="tabular">{r.grams} g</span>
              </p>
              <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {r.customer.name || r.customer.email} · {r.customer.email}
              </p>
              <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Total ₹{formatInr(r.total_inr)} (incl. GST) · rate ₹{formatInr(r.metal_rate_inr_per_gram)}/g
              </p>
              {r.customer_note ? (
                <p style={{ margin: '0.35rem 0', fontSize: '0.8rem' }}>Note: {r.customer_note}</p>
              ) : null}
              <button
                type="button"
                className="btn btn-primary btn--block"
                style={{ marginTop: '0.75rem' }}
                disabled={busyId != null}
                onClick={() => void verify(r.id)}
              >
                {busyId === r.id ? 'Verifying…' : 'Confirm payment received'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
