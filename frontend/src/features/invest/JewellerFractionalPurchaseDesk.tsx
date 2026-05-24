import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  jewellerFractionalApprove,
  jewellerFractionalBulkApprove,
  jewellerFractionalOrdersDesk,
  jewellerFractionalReject,
  jewellerFractionalVerify,
  type JewellerFractionalDeskRow,
} from '@/lib/fractionalPurchaseApi'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

const DESK_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'cancelled', label: 'Cancelled' },
] as const

type DeskTab = (typeof DESK_TABS)[number]['id']

const UPI_REVIEW_STATUSES = new Set([
  'signal_received',
  'pending_review',
  'needs_manual_verification',
  'awaiting_utr_verify',
])

const OTP_LEN = 6

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

function CustomerOtpExpiryHint({ expiresAt }: { expiresAt?: string | null }) {
  const { expired, labelMmSs } = useCounterOtpCountdown(expiresAt ?? null)
  if (!expiresAt) {
    return (
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
        No OTP issued yet — customer taps Generate OTP after paying.
      </p>
    )
  }
  return (
    <p
      style={{
        margin: '0.35rem 0 0',
        fontSize: '0.72rem',
        color: expired ? 'var(--danger)' : 'var(--text-muted)',
        fontWeight: expired ? 700 : 400,
      }}
    >
      {expired ? 'OTP expired — customer must generate a new code.' : `OTP valid ${labelMmSs} remaining`}
    </p>
  )
}

type VerifiedReceipt = {
  reference: string
  grams: string
  totalInr: string
  customerLabel: string
}

export function JewellerFractionalPurchaseDesk() {
  const [tab, setTab] = useState<DeskTab>('pending')
  const [pending, setPending] = useState<JewellerFractionalDeskRow[]>([])
  const [approved, setApproved] = useState<JewellerFractionalDeskRow[]>([])
  const [cancelled, setCancelled] = useState<JewellerFractionalDeskRow[]>([])
  const [summary, setSummary] = useState({ pending_action_count: 0, pending_count: 0 })
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [otpByOrderId, setOtpByOrderId] = useState<Record<number, string>>({})
  const [verifiedReceipt, setVerifiedReceipt] = useState<VerifiedReceipt | null>(null)
  const successRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setErr('')
    const out = await jewellerFractionalOrdersDesk()
    if (!out.ok) {
      setErr(out.detail)
      setPending([])
      setApproved([])
      setCancelled([])
      return
    }
    setPending(out.data.pending)
    setApproved(out.data.approved)
    setCancelled(out.data.cancelled)
    setSummary({
      pending_action_count: out.data.summary.pending_action_count,
      pending_count: out.data.summary.pending_count,
    })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyId == null)

  useEffect(() => {
    if (verifiedReceipt && successRef.current) {
      successRef.current.focus()
    }
  }, [verifiedReceipt])

  const highConfidenceUpi = useMemo(
    () =>
      pending.filter(
        (r) =>
          r.payment_method === 'upi' &&
          UPI_REVIEW_STATUSES.has(r.status) &&
          (r.reconciliation_score ?? 0) >= 60,
      ),
    [pending],
  )

  const rows = tab === 'pending' ? pending : tab === 'approved' ? approved : cancelled

  const verifyOtp = async (row: JewellerFractionalDeskRow) => {
    const otp = (otpByOrderId[row.id] ?? '').trim()
    if (otp.length !== OTP_LEN) {
      setErr(`Enter all ${OTP_LEN} digits from the customer's app.`)
      return
    }
    setBusyId(row.id)
    setErr('')
    try {
      const out = await jewellerFractionalVerify(row.id, otp)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setVerifiedReceipt({
        reference: out.data.reference,
        grams: out.data.grams,
        totalInr: out.data.total_inr,
        customerLabel: row.customer.name || row.customer.email,
      })
      setOtpByOrderId((m) => {
        const next = { ...m }
        delete next[row.id]
        return next
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const confirmUpi = async (row: JewellerFractionalDeskRow) => {
    setBusyId(row.id)
    setErr('')
    try {
      const out = await jewellerFractionalApprove(row.id)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setVerifiedReceipt({
        reference: out.data.reference,
        grams: out.data.grams,
        totalInr: out.data.total_inr,
        customerLabel: row.customer.name || row.customer.email,
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const rejectUpi = async (row: JewellerFractionalDeskRow) => {
    setBusyId(row.id)
    setErr('')
    try {
      const out = await jewellerFractionalReject(row.id)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const bulkApprove = async () => {
    setBusyId(-1)
    setErr('')
    try {
      const out = await jewellerFractionalBulkApprove(60)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      if (out.approved > 0) {
        setVerifiedReceipt({
          reference: `${out.approved} order(s)`,
          grams: '—',
          totalInr: '—',
          customerLabel: 'Bulk approval',
        })
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="dash-panel-max jeweller-counter-verify-panel">
      <p className="dash-panel-lead">
        All fractional purchases for your store — counter OTP and online UPI. Confirm payments after the customer has
        paid; gold credits to their vault and your liability ledger updates on approval.
      </p>

      <DashSegmentPair
        items={[...DESK_TABS]}
        value={tab}
        onChange={(id) => setTab(id as DeskTab)}
        ariaLabel="Purchase desk tab"
        className="fractional-jeweller-verify-tabs"
      />

      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
        {tab === 'pending' && summary.pending_action_count > 0 ? (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {summary.pending_action_count} need your action · {summary.pending_count} total open
          </span>
        ) : null}
      </div>

      {verifiedReceipt ? (
        <div
          ref={successRef}
          tabIndex={-1}
          className="admin-dash-form-success admin-dash-form-success--block"
          style={{ maxWidth: '42rem', padding: '1rem 1.15rem', marginBottom: '1.25rem' }}
          role="status"
        >
          <p style={{ margin: 0, fontWeight: 800, color: 'var(--success)' }}>Payment verified</p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
            Order <strong>{verifiedReceipt.reference}</strong> — {verifiedReceipt.customerLabel} ·{' '}
            {verifiedReceipt.grams} g · ₹{formatInr(verifiedReceipt.totalInr)}
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: '0.5rem' }}
            onClick={() => setVerifiedReceipt(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {err ? (
        <p className="form-error" style={{ marginBottom: '1rem' }} role="alert">
          {err}
        </p>
      ) : null}

      {tab === 'pending' && highConfidenceUpi.length > 0 ? (
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginBottom: '1rem' }}
          disabled={busyId != null}
          onClick={() => void bulkApprove()}
        >
          {busyId === -1 ? 'Approving…' : `Approve all high confidence (${highConfidenceUpi.length})`}
        </button>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          {tab === 'pending'
            ? 'No pending purchases.'
            : tab === 'approved'
              ? 'No approved purchases yet.'
              : 'No cancelled or rejected purchases.'}
        </p>
      ) : (
        <div className="jeweller-purchases-wrap">
          <table className="jeweller-purchases-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Order</th>
                <th scope="col">Method</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">UTR / Score</th>
                <th scope="col">Created</th>
                {tab === 'pending' ? <th scope="col">Actions</th> : null}
                {tab === 'approved' ? <th scope="col">Verified</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const otp = otpByOrderId[r.id] ?? ''
                const canReviewUpi = r.payment_method === 'upi' && UPI_REVIEW_STATUSES.has(r.status)
                const awaitingCustomer = r.payment_method === 'upi' && r.status === 'pending_payment'
                return (
                  <tr key={r.id}>
                    <td data-label="Customer">
                      <strong>{r.customer.name || r.customer.email}</strong>
                      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {r.customer.email}
                      </span>
                      {r.customer.cridora_member_id ? (
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                          {r.customer.cridora_member_id}
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Order">
                      <strong className="tabular">{r.reference}</strong>
                      {r.order_reference ? (
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {r.order_reference}
                        </span>
                      ) : null}
                      {r.payment_note ? (
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                          {r.payment_note}
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Method">{r.payment_method === 'upi' ? 'UPI' : 'Counter'}</td>
                    <td data-label="Amount">
                      <strong className="tabular">₹{formatInr(r.total_inr)}</strong>
                      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {r.grams} g @ ₹{formatInr(r.metal_rate_inr_per_gram)}/g
                      </span>
                    </td>
                    <td data-label="Status">{statusLabel(r.status)}</td>
                    <td data-label="UTR / Score">
                      {r.upi_utr ? (
                        <strong className="tabular fractional-upi-utr-display">{r.upi_utr}</strong>
                      ) : (
                        '—'
                      )}
                      {r.reconciliation_score != null ? (
                        <span style={{ display: 'block', fontSize: '0.78rem' }}>{r.reconciliation_score}% match</span>
                      ) : null}
                    </td>
                    <td data-label="Created">{formatWhen(r.created_at)}</td>
                    {tab === 'pending' ? (
                      <td data-label="Actions">
                        {r.payment_method === 'counter' && r.status === 'awaiting_counter' ? (
                          <div className="jeweller-purchases-otp-stack">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={OTP_LEN}
                              className="tabular jeweller-purchases-otp-input"
                              value={otp}
                              onChange={(e) => {
                                setErr('')
                                setOtpByOrderId((m) => ({
                                  ...m,
                                  [r.id]: e.target.value.replace(/\D/g, '').slice(0, OTP_LEN),
                                }))
                              }}
                              placeholder="······"
                              aria-label={`OTP for ${r.reference}`}
                            />
                            <CustomerOtpExpiryHint expiresAt={r.otp_expires_at} />
                            <button
                              type="button"
                              className="btn btn-primary jeweller-purchases-verify-btn"
                              disabled={busyId != null || otp.length !== OTP_LEN}
                              onClick={() => void verifyOtp(r)}
                            >
                              {busyId === r.id ? 'Verifying…' : 'Verify OTP'}
                            </button>
                          </div>
                        ) : null}
                        {canReviewUpi ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary jeweller-purchases-verify-btn"
                              disabled={busyId != null}
                              onClick={() => void confirmUpi(r)}
                            >
                              {busyId === r.id ? 'Confirming…' : 'Confirm payment'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost jeweller-purchases-verify-btn"
                              style={{ marginTop: '0.35rem' }}
                              disabled={busyId != null}
                              onClick={() => void rejectUpi(r)}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        {awaitingCustomer ? (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Awaiting customer confirmation
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                    {tab === 'approved' ? <td data-label="Verified">{formatWhen(r.jeweller_verified_at)}</td> : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
