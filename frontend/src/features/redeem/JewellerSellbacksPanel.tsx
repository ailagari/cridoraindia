import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchJewellerSellbacks,
  postJewellerSellbackAccept,
  postJewellerSellbackComplete,
  postJewellerSellbackReject,
  type JewellerSellbackRowDTO,
} from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function fmtInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function fmtWhen(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function statusLabel(st: string): string {
  if (st === 'pending_jeweller') return 'Pending your action'
  if (st === 'accepted_awaiting_otp') return 'Accepted · enter OTP'
  if (st === 'completed') return 'Completed'
  if (st === 'rejected') return 'Rejected'
  return st
}

export function JewellerSellbacksPanel() {
  const [rows, setRows] = useState<JewellerSellbackRowDTO[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [otpDraft, setOtpDraft] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    setLoadErr('')
    const payload = await fetchJewellerSellbacks()
    if (!payload) {
      setLoadErr('Could not load sellbacks.')
      setRows([])
      return
    }
    setRows(payload.results ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  const { queue, history } = useMemo(() => {
    const q: JewellerSellbackRowDTO[] = []
    const h: JewellerSellbackRowDTO[] = []
    for (const r of rows) {
      if (r.status === 'pending_jeweller' || r.status === 'accepted_awaiting_otp') q.push(r)
      else h.push(r)
    }
    return { queue: q, history: h }
  }, [rows])

  const onAccept = async (id: number) => {
    setBusyId(id)
    const out = await postJewellerSellbackAccept(id)
    setBusyId(null)
    if (!out.ok) {
      setLoadErr(out.detail)
      return
    }
    setLoadErr('')
    await refresh()
  }

  const onReject = async (id: number) => {
    setBusyId(id)
    const out = await postJewellerSellbackReject(id)
    setBusyId(null)
    if (!out.ok) {
      setLoadErr(out.detail)
      return
    }
    setLoadErr('')
    await refresh()
  }

  const onComplete = async (id: number) => {
    const otp = (otpDraft[id] ?? '').trim()
    if (!otp) {
      setLoadErr('Enter the customer’s 6-digit OTP.')
      return
    }
    setBusyId(id)
    const out = await postJewellerSellbackComplete(id, otp)
    setBusyId(null)
    if (!out.ok) {
      setLoadErr(out.detail)
      return
    }
    setLoadErr('')
    setOtpDraft((d) => {
      const next = { ...d }
      delete next[id]
      return next
    })
    await refresh()
  }

  const renderRowCells = (r: JewellerSellbackRowDTO, showActions: boolean) => (
    <>
      <td data-label="When">{fmtWhen(r.updated_at)}</td>
      <td data-label="Ref">
        <strong className="tabular">{r.reference}</strong>
      </td>
      <td data-label="Customer">{r.customer_label}</td>
      <td data-label="Phone">
        {r.customer_phone !== '—' ? (
          <a href={`tel:${r.customer_phone.replace(/\D/g, '')}`} className="tabular">
            {r.customer_phone}
          </a>
        ) : (
          <span style={{ color: 'var(--text-faint)' }}>— add phone on profile</span>
        )}
      </td>
      <td data-label="Status">{statusLabel(r.status)}</td>
      <td data-label="Grams">
        <span className="tabular">{r.grams} g</span>
      </td>
      <td data-label="Buyback ₹/g">
        <span className="tabular">₹{fmtInr(r.buyback_inr_per_gram_snapshot)}</span>
      </td>
      <td data-label="Est. cash ₹">
        <span className="tabular">₹{fmtInr(r.cash_estimate_inr)}</span>
      </td>
      {showActions ? (
        <td data-label="Actions">
          {r.status === 'pending_jeweller' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.68rem', padding: '0.35rem 0.55rem' }}
                disabled={busyId === r.id}
                onClick={() => void onAccept(r.id)}
              >
                Accept
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '0.68rem', padding: '0.35rem 0.55rem' }}
                disabled={busyId === r.id}
                onClick={() => void onReject(r.id)}
              >
                Reject
              </button>
            </div>
          ) : r.status === 'accepted_awaiting_otp' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Customer OTP"
                className="tabular"
                value={otpDraft[r.id] ?? ''}
                maxLength={8}
                disabled={busyId === r.id}
                onChange={(e) =>
                  setOtpDraft((d) => ({
                    ...d,
                    [r.id]: e.target.value.replace(/\D/g, '').slice(0, 6),
                  }))
                }
                style={{
                  width: '7rem',
                  padding: '0.35rem 0.45rem',
                  borderRadius: 8,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--veil)',
                  fontFamily: 'var(--font)',
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.68rem', padding: '0.35rem 0.55rem' }}
                disabled={busyId === r.id}
                onClick={() => void onComplete(r.id)}
              >
                Settle (verify OTP)
              </button>
            </div>
          ) : (
            '—'
          )}
        </td>
      ) : null}
    </>
  )

  return (
    <div className="dash-panel-max pf-scope">
      <h2 className="dash-panel-title">Cash sellbacks</h2>
      <p className="dash-panel-lead">
        Real-time sellback queue from customers. Call them on the phone number shown to confirm identity and collect their{' '}
        <strong>OTP</strong> after you pay cash <strong>outside Cridora</strong>. Accept first, complete payout offline,
        then enter OTP to debit vault gold.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      {rows.length === 0 && !loadErr ? (
        <p style={{ color: 'var(--text-muted)' }}>No sellback records yet.</p>
      ) : (
        <>
          <h3 style={{ margin: '0 0 0.55rem', fontSize: '0.95rem' }}>Needs action</h3>
          {queue.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.85rem' }}>
              No pending sellback requests.
            </p>
          ) : (
            <div className="jeweller-sellbacks-wrap" style={{ marginBottom: '1.35rem' }}>
              <table className="jeweller-sellbacks-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Ref</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Status</th>
                    <th scope="col">Grams</th>
                    <th scope="col">Buyback ₹/g</th>
                    <th scope="col">Est. cash ₹</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>{queue.map((r) => <tr key={r.id}>{renderRowCells(r, true)}</tr>)}</tbody>
              </table>
            </div>
          )}

          <h3 style={{ margin: '0 0 0.55rem', fontSize: '0.95rem' }}>History</h3>
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No completed or rejected rows yet.</p>
          ) : (
            <div className="jeweller-sellbacks-wrap">
              <table className="jeweller-sellbacks-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Ref</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Status</th>
                    <th scope="col">Grams</th>
                    <th scope="col">Buyback ₹/g</th>
                    <th scope="col">Est. cash ₹</th>
                  </tr>
                </thead>
                <tbody>{history.map((r) => <tr key={r.id}>{renderRowCells(r, false)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
