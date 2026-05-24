import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import {
  jewellerFractionalApprove,
  jewellerFractionalBulkApprove,
  jewellerFractionalReject,
  jewellerFractionalVerify,
} from '@/lib/fractionalPurchaseApi'
import {
  jewellerCridoraPayMarkCashPaid,
  jewellerCridoraPayMarkUpiPaid,
  jewellerCridoraPayVerifyVaultOtp,
} from '@/lib/cridorapayApi'
import { jewellerGoldDepositVerify } from '@/lib/goldDepositApi'
import {
  postJewellerLoanAccept,
  postJewellerLoanComplete,
  postJewellerLoanReject,
} from '@/lib/goldLoanApi'
import {
  jewellerSubmitSellbackUtr,
  postJewellerSellbackAccept,
  postJewellerSellbackComplete,
  postJewellerSellbackReject,
} from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import {
  jewellerUnifiedDeskTransactions,
  type UnifiedDeskRow,
} from '@/lib/jewellerUnifiedDeskApi'
import { useLivePoll } from '@/lib/useLivePoll'

const DESK_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
] as const

type DeskTab = (typeof DESK_TABS)[number]['id']

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'fractional', label: 'Fractional' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'ornament_redemption', label: 'Ornament' },
  { value: 'cridorapay', label: 'CridoraPay' },
  { value: 'sellback', label: 'Sellback' },
  { value: 'loan_fee', label: 'Loan fee' },
]

const METHOD_OPTIONS = [
  { value: '', label: 'All methods' },
  { value: 'upi', label: 'UPI' },
  { value: 'counter', label: 'Counter' },
  { value: 'vault', label: 'Vault' },
  { value: 'cash', label: 'Cash' },
  { value: 'mixed', label: 'Mixed' },
]

const TYPE_LABEL: Record<string, string> = {
  fractional: 'Fractional',
  deposit: 'Deposit',
  ornament_redemption: 'Ornament',
  cridorapay: 'CridoraPay',
  sellback: 'Sellback',
  loan_fee: 'Loan fee',
}

const OTP_LEN = 6

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function CustomerOtpExpiryHint({ expiresAt }: { expiresAt?: string | null }) {
  const { expired, labelMmSs } = useCounterOtpCountdown(expiresAt ?? null)
  if (!expiresAt || expired) return null
  return (
    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
      OTP expires in {labelMmSs}
    </span>
  )
}

type VerifiedReceipt = {
  reference: string
  amount: string
  customerLabel: string
}

export function JewellerUnifiedPurchaseDesk() {
  const [tab, setTab] = useState<DeskTab>('pending')
  const [typeFilter, setTypeFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [rows, setRows] = useState<UnifiedDeskRow[]>([])
  const [summary, setSummary] = useState({ pending_action_count: 0, pending_count: 0 })
  const [err, setErr] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [otpByKey, setOtpByKey] = useState<Record<string, string>>({})
  const [utrByKey, setUtrByKey] = useState<Record<string, string>>({})
  const [verifiedReceipt, setVerifiedReceipt] = useState<VerifiedReceipt | null>(null)
  const successRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setErr('')
    const out = await jewellerUnifiedDeskTransactions({
      bucket: tab,
      type: typeFilter || undefined,
      method: methodFilter || undefined,
      limit: 100,
    })
    if (!out.ok) {
      setErr(out.detail)
      setRows([])
      return
    }
    setRows(out.data.results)
    setSummary(out.data.summary)
  }, [tab, typeFilter, methodFilter])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyKey == null)

  useEffect(() => {
    if (verifiedReceipt && successRef.current) {
      successRef.current.focus()
    }
  }, [verifiedReceipt])

  const highConfidenceFractional = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.transaction_type === 'fractional' &&
          r.payment_method === 'upi' &&
          r.actions.includes('confirm_upi') &&
          typeof r.detail.reconciliation_score === 'number' &&
          (r.detail.reconciliation_score as number) >= 60,
      ),
    [rows],
  )

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runAction = async (row: UnifiedDeskRow, fn: () => Promise<{ ok: boolean; detail?: string }>) => {
    setBusyKey(row.id)
    setErr('')
    try {
      const out = await fn()
      if (!out.ok) {
        setErr(out.detail ?? 'Action failed')
        return
      }
      setVerifiedReceipt({
        reference: row.reference,
        amount: row.amount_inr,
        customerLabel: row.customer.name || row.customer.email,
      })
      await load()
    } finally {
      setBusyKey(null)
    }
  }

  const handleVerifyOtp = async (row: UnifiedDeskRow) => {
    const otp = (otpByKey[row.id] ?? '').trim()
    if (otp.length !== OTP_LEN) {
      setErr(`Enter all ${OTP_LEN} digits from the customer's app.`)
      return
    }
    if (row.source_model === 'fractional_gold_purchase') {
      await runAction(row, async () => {
        const out = await jewellerFractionalVerify(row.source_id, otp)
        return out.ok ? { ok: true } : { ok: false, detail: out.detail }
      })
    } else if (row.source_model === 'gold_deposit_intake') {
      await runAction(row, async () => {
        const out = await jewellerGoldDepositVerify(row.source_id, otp)
        return out.ok ? { ok: true } : { ok: false, detail: out.detail }
      })
    } else if (row.source_model === 'cridorapay_bill') {
      await runAction(row, async () => {
        const out = await jewellerCridoraPayVerifyVaultOtp(row.source_id, otp)
        return out.ok ? { ok: true } : { ok: false, detail: out.detail }
      })
    } else if (row.source_model === 'gold_sellback_request') {
      await runAction(row, async () => {
        const out = await postJewellerSellbackComplete(row.source_id, otp)
        return out.ok ? { ok: true } : { ok: false, detail: out.detail }
      })
    } else if (row.source_model === 'gold_loan_request') {
      await runAction(row, async () => {
        const out = await postJewellerLoanComplete(row.source_id, otp)
        return out.ok ? { ok: true } : { ok: false, detail: out.detail }
      })
    }
  }

  const bulkApprove = async () => {
    setBusyKey('bulk')
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
          amount: '—',
          customerLabel: 'Bulk approval',
        })
      }
      await load()
    } finally {
      setBusyKey(null)
    }
  }

  const renderActions = (row: UnifiedDeskRow) => {
    if (tab !== 'pending' || row.actions.length === 0) return null
    const otp = otpByKey[row.id] ?? ''
    const utr = utrByKey[row.id] ?? ''
    const busy = busyKey === row.id

    if (row.actions.includes('verify_otp') || row.actions.includes('verify_deposit_otp') || row.actions.includes('verify_vault_otp') || row.actions.includes('complete_sellback_otp') || row.actions.includes('complete_loan_otp')) {
      return (
        <div className="jeweller-purchases-otp-stack">
          <input
            type="text"
            inputMode="numeric"
            maxLength={OTP_LEN}
            className="tabular jeweller-purchases-otp-input"
            value={otp}
            onChange={(e) => {
              setErr('')
              setOtpByKey((m) => ({ ...m, [row.id]: e.target.value.replace(/\D/g, '').slice(0, OTP_LEN) }))
            }}
            placeholder="······"
            aria-label={`OTP for ${row.reference}`}
          />
          <CustomerOtpExpiryHint expiresAt={row.detail.otp_expires_at as string | undefined} />
          <button
            type="button"
            className="btn btn-primary jeweller-purchases-verify-btn"
            disabled={busyKey != null || otp.length !== OTP_LEN}
            onClick={() => void handleVerifyOtp(row)}
          >
            {busy ? 'Verifying…' : 'Verify OTP'}
          </button>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {row.actions.includes('confirm_upi') ? (
          <button
            type="button"
            className="btn btn-primary jeweller-purchases-verify-btn"
            disabled={busyKey != null}
            onClick={() =>
              void runAction(row, async () => {
                const out = await jewellerFractionalApprove(row.source_id)
                return out.ok ? { ok: true } : { ok: false, detail: out.detail }
              })
            }
          >
            Confirm payment
          </button>
        ) : null}
        {row.actions.includes('reject_upi') ? (
          <button
            type="button"
            className="btn btn-ghost jeweller-purchases-verify-btn"
            disabled={busyKey != null}
            onClick={() =>
              void runAction(row, async () => {
                const out = await jewellerFractionalReject(row.source_id)
                return out.ok ? { ok: true } : { ok: false, detail: out.detail }
              })
            }
          >
            Reject
          </button>
        ) : null}
        {row.actions.includes('accept_sellback') ? (
          <button
            type="button"
            className="btn btn-primary jeweller-purchases-verify-btn"
            disabled={busyKey != null}
            onClick={() =>
              void runAction(row, async () => {
                const out = await postJewellerSellbackAccept(row.source_id)
                return out.ok ? { ok: true } : { ok: false, detail: out.detail }
              })
            }
          >
            Accept sellback
          </button>
        ) : null}
        {row.actions.includes('reject_sellback') ? (
          <button
            type="button"
            className="btn btn-ghost jeweller-purchases-verify-btn"
            disabled={busyKey != null}
            onClick={() =>
              void runAction(row, async () => {
                const out = await postJewellerSellbackReject(row.source_id)
                return out.ok ? { ok: true } : { ok: false, detail: out.detail }
              })
            }
          >
            Reject
          </button>
        ) : null}
        {row.actions.includes('accept_loan') ? (
          <button
            type="button"
            className="btn btn-primary jeweller-purchases-verify-btn"
            disabled={busyKey != null}
            onClick={() =>
              void runAction(row, async () => {
                const out = await postJewellerLoanAccept(row.source_id)
                return out.ok ? { ok: true } : { ok: false, detail: out.detail }
              })
            }
          >
            Accept loan
          </button>
        ) : null}
        {row.actions.includes('reject_loan') ? (
          <button
            type="button"
            className="btn btn-ghost jeweller-purchases-verify-btn"
            disabled={busyKey != null}
            onClick={() =>
              void runAction(row, async () => {
                const out = await postJewellerLoanReject(row.source_id)
                return out.ok ? { ok: true } : { ok: false, detail: out.detail }
              })
            }
          >
            Reject loan
          </button>
        ) : null}
        {row.actions.includes('mark_upi_paid') ? (
          <button
            type="button"
            className="btn btn-primary jeweller-purchases-verify-btn"
            disabled={busyKey != null}
            onClick={() =>
              void runAction(row, async () => {
                const out = await jewellerCridoraPayMarkUpiPaid(row.source_id)
                return out.ok ? { ok: true } : { ok: false, detail: out.detail }
              })
            }
          >
            Mark UPI paid
          </button>
        ) : null}
        {row.actions.includes('mark_cash_paid') ? (
          <button
            type="button"
            className="btn btn-primary jeweller-purchases-verify-btn"
            disabled={busyKey != null}
            onClick={() =>
              void runAction(row, async () => {
                const out = await jewellerCridoraPayMarkCashPaid(row.source_id)
                return out.ok ? { ok: true } : { ok: false, detail: out.detail }
              })
            }
          >
            Mark cash paid
          </button>
        ) : null}
        {row.actions.includes('submit_sellback_utr') ? (
          <>
            <input
              type="text"
              className="tabular"
              value={utr}
              onChange={(e) => setUtrByKey((m) => ({ ...m, [row.id]: e.target.value }))}
              placeholder="UTR number"
              aria-label={`UTR for ${row.reference}`}
            />
            <button
              type="button"
              className="btn btn-primary jeweller-purchases-verify-btn"
              disabled={busyKey != null || utr.trim().length < 8}
              onClick={() =>
                void runAction(row, async () => {
                  const out = await jewellerSubmitSellbackUtr(row.source_id, utr.trim())
                  return out.ok ? { ok: true } : { ok: false, detail: out.detail }
                })
              }
            >
              Submit UTR
            </button>
          </>
        ) : null}
      </div>
    )
  }

  const renderDetail = (row: UnifiedDeskRow) => {
    const entries = Object.entries(row.detail).filter(([, v]) => v != null && v !== '')
    if (entries.length === 0) return <p style={{ margin: 0, color: 'var(--text-muted)' }}>No extra detail.</p>
    return (
      <dl style={{ margin: 0, fontSize: '0.82rem', display: 'grid', gap: '0.25rem' }}>
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt style={{ display: 'inline', fontWeight: 600 }}>{k.replace(/_/g, ' ')}: </dt>
            <dd style={{ display: 'inline', margin: 0 }}>
              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </dd>
          </div>
        ))}
        <div>
          <dt style={{ display: 'inline', fontWeight: 600 }}>member id: </dt>
          <dd style={{ display: 'inline', margin: 0 }}>{row.customer.member_id || '—'}</dd>
        </div>
        <div>
          <dt style={{ display: 'inline', fontWeight: 600 }}>completed: </dt>
          <dd style={{ display: 'inline', margin: 0 }}>{formatWhen(row.completed_at)}</dd>
        </div>
      </dl>
    )
  }

  return (
    <div className="dash-panel-max jeweller-counter-verify-panel">
      <p className="dash-panel-lead">
        All customer transactions — fractional, deposits, CridoraPay, ornaments, sellbacks, and loan fees — in one desk.
      </p>

      <DashSegmentPair
        items={[...DESK_TABS]}
        value={tab}
        onChange={(id) => setTab(id as DeskTab)}
        ariaLabel="Purchase desk tab"
        className="fractional-jeweller-verify-tabs"
      />

      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type">
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} aria-label="Filter by method">
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
        {tab === 'pending' && summary.pending_action_count > 0 ? (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {summary.pending_action_count} need action · {summary.pending_count} open
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
          <p style={{ margin: 0, fontWeight: 800, color: 'var(--success)' }}>Updated</p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
            <strong>{verifiedReceipt.reference}</strong> — {verifiedReceipt.customerLabel} · ₹
            {formatInr(verifiedReceipt.amount)}
          </p>
          <button type="button" className="btn btn-ghost" style={{ marginTop: '0.5rem' }} onClick={() => setVerifiedReceipt(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {err ? (
        <p className="form-error" style={{ marginBottom: '1rem' }} role="alert">
          {err}
        </p>
      ) : null}

      {tab === 'pending' && highConfidenceFractional.length > 0 ? (
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginBottom: '1rem' }}
          disabled={busyKey != null}
          onClick={() => void bulkApprove()}
        >
          {busyKey === 'bulk' ? 'Approving…' : `Approve high-confidence UPI (${highConfidenceFractional.length})`}
        </button>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No transactions in this bucket.</p>
      ) : (
        <div className="jeweller-purchases-wrap">
          <table className="jeweller-purchases-table">
            <thead>
              <tr>
                <th scope="col" aria-label="Expand" />
                <th scope="col">Customer</th>
                <th scope="col">Order</th>
                <th scope="col">Type</th>
                <th scope="col">Amount</th>
                <th scope="col">Method</th>
                <th scope="col">OTP / UTR</th>
                <th scope="col">Status</th>
                <th scope="col">Platform fee</th>
                {tab === 'pending' ? <th scope="col">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOpen = expanded.has(row.id)
                return (
                    <Fragment key={row.id}>
                      <tr>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          aria-expanded={isOpen}
                          onClick={() => toggleExpanded(row.id)}
                        >
                          {isOpen ? '−' : '+'}
                        </button>
                      </td>
                      <td data-label="Customer">
                        <strong>{row.customer.name || row.customer.email}</strong>
                      </td>
                      <td data-label="Order">
                        <strong className="tabular">{row.reference}</strong>
                      </td>
                      <td data-label="Type">{TYPE_LABEL[row.transaction_type] ?? row.transaction_type}</td>
                      <td data-label="Amount">
                        <strong className="tabular">₹{formatInr(row.amount_inr)}</strong>
                        {row.grams && row.grams !== '0' ? (
                          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {row.grams} g
                          </span>
                        ) : null}
                      </td>
                      <td data-label="Method">{row.payment_method}</td>
                      <td data-label="OTP / UTR">{row.otp_utr || '—'}</td>
                      <td data-label="Status">{row.status}</td>
                      <td data-label="Platform fee">₹{formatInr(row.platform_fee_inr)}</td>
                      {tab === 'pending' ? <td data-label="Actions">{renderActions(row)}</td> : null}
                    </tr>
                    {isOpen ? (
                      <tr key={`${row.id}-detail`}>
                        <td colSpan={tab === 'pending' ? 10 : 9} style={{ background: 'var(--surface-muted, rgba(0,0,0,0.03))' }}>
                          {renderDetail(row)}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
