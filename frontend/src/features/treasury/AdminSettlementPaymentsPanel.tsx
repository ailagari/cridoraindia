import { useCallback, useEffect, useState } from 'react'
import {
  adminTreasuryPaymentConfirm,
  adminTreasuryPaymentReject,
  adminTreasuryPayments,
  type SettlementPaymentRow,
} from '@/lib/adminTreasuryApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function AdminSettlementPaymentsPanel() {
  const [rows, setRows] = useState<SettlementPaymentRow[]>([])
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setErr('')
    const out = await adminTreasuryPayments()
    if (!out.ok) {
      setErr(out.detail)
      setRows([])
      return
    }
    setRows(out.results)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyId == null)

  const confirm = async (id: number) => {
    setBusyId(id)
    const out = await adminTreasuryPaymentConfirm(id)
    if (!out.ok) setErr(out.detail)
    else await load()
    setBusyId(null)
  }

  const reject = async (id: number) => {
    const reason = window.prompt('Rejection reason (optional)') ?? ''
    setBusyId(id)
    const out = await adminTreasuryPaymentReject(id, reason)
    if (!out.ok) setErr(out.detail)
    else await load()
    setBusyId(null)
  }

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">Settlement payments submitted by jewellers — confirm after verifying bank receipts.</p>
      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}
      <table className="jeweller-purchases-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Jeweller</th>
            <th>Direction</th>
            <th>Amount</th>
            <th>UTR</th>
            <th>Status</th>
            <th>Receipt</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8}>No payment records.</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at.slice(0, 16).replace('T', ' ')}</td>
                <td>{r.jeweller_name}</td>
                <td>{r.direction.replace(/_/g, ' ')}</td>
                <td className="tabular">₹{formatInr(r.amount_inr)}</td>
                <td>{r.utr || '—'}</td>
                <td>{r.status}</td>
                <td>
                  {r.has_receipt && r.receipt_url ? (
                    <a href={r.receipt_url} target="_blank" rel="noreferrer">
                      View
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {r.status === 'submitted' ? (
                    <>
                      <button type="button" className="btn btn-primary" disabled={busyId != null} onClick={() => void confirm(r.id)}>
                        Confirm
                      </button>
                      <button type="button" className="btn btn-ghost" disabled={busyId != null} onClick={() => void reject(r.id)}>
                        Reject
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
