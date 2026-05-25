import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { UpiPaymentStep } from '@/features/upi/UpiPaymentStep'
import { UpiProofReviewActions } from '@/features/upi/UpiProofReviewActions'
import { UpiProofTableCell } from '@/features/upi/UpiProofTableCell'
import {
  SettlementOtpPayerStep,
  SettlementOtpVerifyInput,
} from '@/features/treasury/SettlementOtpSteps'
import {
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

const FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'all', label: 'All' },
] as const

type Filter = (typeof FILTERS)[number]['id']

function proofCell(row: SettlementPaymentRow) {
  if (row.payment_method === 'otp') {
    if (row.status === 'confirmed') {
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
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
  }
  return <UpiProofTableCell utr={row.upi_utr || row.utr} proofFileUrl={row.proof_file_url || row.receipt_url} />
}

export function AdminSettlementPaymentsPanel() {
  const [rows, setRows] = useState<SettlementPaymentRow[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [upiBusy, setUpiBusy] = useState(false)

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

  const filtered = useMemo(() => {
    if (filter === 'pending') {
      return rows.filter((r) => r.status === 'submitted' || r.status === 'pending_proof')
    }
    if (filter === 'confirmed') return rows.filter((r) => r.status === 'confirmed')
    return rows
  }, [filter, rows])

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Settlement payments — review UPI proof or verify offline OTP from jewellers; initiate platform payouts.
      </p>
      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? <p className="form-success">{msg}</p> : null}

      <DashSegmentPair
        items={[...FILTERS]}
        value={filter}
        onChange={(id) => setFilter(id as Filter)}
        ariaLabel="Payment filter"
      />

      <table className="jeweller-purchases-table" style={{ marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>When</th>
            <th>Jeweller</th>
            <th>Direction</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Proof</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={8}>No payment records.</td>
            </tr>
          ) : (
            filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at.slice(0, 16).replace('T', ' ')}</td>
                <td>{r.jeweller_name}</td>
                <td>{r.direction.replace(/_/g, ' ')}</td>
                <td>{r.payment_method.toUpperCase()}</td>
                <td className="tabular">₹{formatInr(r.amount_inr)}</td>
                <td>{r.status}</td>
                <td>{proofCell(r)}</td>
                <td>
                  {r.payment_method === 'upi' &&
                  r.status === 'submitted' &&
                  r.direction === 'jeweller_to_platform' ? (
                    <UpiProofReviewActions
                      kind="settlement"
                      paymentId={r.id}
                      reference={`SET-${r.id}`}
                      amountInr={r.amount_inr}
                      upiUtr={r.upi_utr || r.utr}
                      proofFileUrl={r.proof_file_url || r.receipt_url}
                      rejectionCount={r.upi_rejection_count}
                      lastRemark={r.upi_last_rejection_remark}
                      fraudReported={r.upi_fraud_reported}
                      compact
                      busy={busyId === r.id}
                      onBusyChange={(v) => setBusyId(v ? r.id : null)}
                      onDone={(m) => {
                        setMsg(m)
                        void load()
                      }}
                      onError={(m) => setErr(m)}
                    />
                  ) : null}
                  {r.payment_method === 'otp' &&
                  r.direction === 'jeweller_to_platform' &&
                  r.status === 'submitted' ? (
                    <SettlementOtpVerifyInput
                      paymentId={r.id}
                      role="admin"
                      reference={`SET-${r.id}`}
                      busy={busyId === r.id}
                      onBusyChange={(v) => setBusyId(v ? r.id : null)}
                      onDone={(m) => {
                        setMsg(m)
                        void load()
                      }}
                      onError={(m) => setErr(m)}
                    />
                  ) : null}
                  {r.payment_method === 'otp' &&
                  r.direction === 'platform_to_jeweller' &&
                  r.status === 'pending_proof' ? (
                    <SettlementOtpPayerStep
                      paymentId={r.id}
                      role="admin"
                      amountInr={r.amount_inr}
                      busy={busyId === r.id}
                      onBusyChange={(v) => setBusyId(v ? r.id : null)}
                      onIssued={() => {
                        setMsg(`OTP issued for SET-${r.id}.`)
                        void load()
                      }}
                      onError={(m) => setErr(m)}
                    />
                  ) : null}
                  {r.payment_method === 'upi' &&
                  r.direction === 'platform_to_jeweller' &&
                  r.status === 'pending_proof' ? (
                    <UpiPaymentStep
                      kind="settlement"
                      paymentId={r.id}
                      busy={upiBusy}
                      setBusy={setUpiBusy}
                      onSubmitted={() => void load()}
                      onSuccess={(m) => setMsg(m)}
                      onError={(m) => setErr(m)}
                    />
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
