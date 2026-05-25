import { useCallback, useEffect, useState } from 'react'
import { UpiProofTableCell } from '@/features/upi/UpiProofTableCell'
import { jewellerTreasuryPayments, type SettlementPaymentRow } from '@/lib/adminTreasuryApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function proofCell(row: SettlementPaymentRow) {
  if (row.payment_method === 'otp') {
    if (row.status === 'confirmed' && row.otp_verified) {
      return (
        <span style={{ fontSize: '0.85rem' }}>
          OTP verified
          {row.confirmed_at ? (
            <span style={{ display: 'block', color: 'var(--text-muted)' }}>
              {row.confirmed_at.slice(0, 16).replace('T', ' ')}
            </span>
          ) : null}
        </span>
      )
    }
    if (row.status === 'submitted') {
      return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Awaiting OTP verify</span>
    }
    return <span style={{ color: 'var(--text-muted)' }}>—</span>
  }
  return <UpiProofTableCell utr={row.upi_utr || row.utr} proofFileUrl={row.proof_file_url || row.receipt_url} />
}

export function JewellerSettlementPaymentsPanel() {
  const [rows, setRows] = useState<SettlementPaymentRow[]>([])
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setErr('')
    const out = await jewellerTreasuryPayments()
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

  useLivePoll(load, LIVE_BALANCE_POLL_MS, false)

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">All platform settlement payments — UTR, screenshots, or OTP verification status.</p>
      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}
      <table className="jeweller-purchases-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Direction</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Proof</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6}>No payments yet.</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at.slice(0, 16).replace('T', ' ')}</td>
                <td>{r.direction.replace(/_/g, ' ')}</td>
                <td>{r.payment_method.toUpperCase()}</td>
                <td className="tabular">₹{formatInr(r.amount_inr)}</td>
                <td>{r.status}</td>
                <td>{proofCell(r)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
