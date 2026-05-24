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
  fractional: 'Fractional gold',
  deposit: 'Gold deposit',
  ornament_redemption: 'Jewellery purchase',
  cridorapay: 'CridoraPay bill',
  sellback: 'Sellback',
  loan_fee: 'Loan processing fee',
}

function typeLabel(row: UnifiedDeskRow): string {
  return row.type_label || TYPE_LABEL[row.transaction_type] || row.transaction_type
}

function methodLabel(row: UnifiedDeskRow): string {
  return row.method_label || row.payment_method || '—'
}

function statusLabel(raw: string): string {
  return raw.replace(/_/g, ' ')
}

function platformFeeDisplay(fee: string): string {
  const n = Number.parseFloat(fee)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `₹${formatInr(fee)}`
}

const OTP_LEN = 6

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

const COMPLETE_ACTIONS = new Set([
  'verify_otp',
  'verify_deposit_otp',
  'verify_vault_otp',
  'complete_sellback_otp',
  'complete_loan_otp',
  'confirm_upi',
  'accept_sellback',
  'accept_loan',
])

const CANCEL_ACTIONS = new Set(['reject_upi', 'reject_sellback', 'reject_loan'])

function nextTabAfterAction(row: UnifiedDeskRow, current: DeskTab): DeskTab | null {
  if (current !== 'pending') return null
  if (row.actions.some((a) => COMPLETE_ACTIONS.has(a))) return 'completed'
  if (row.actions.some((a) => CANCEL_ACTIONS.has(a))) return 'cancelled'
  return null
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
      setOtpByKey((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      setUtrByKey((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      const nextTab = nextTabAfterAction(row, tab)
      if (nextTab) {
        setTab(nextTab)
      } else {
        await load()
      }
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
    return (
      <div className="jeweller-unified-desk-detail">
        <dl className="jeweller-unified-desk-detail-grid">
          {entries.map(([k, v]) => (
            <div key={k}>
              <dt>{k.replace(/_/g, ' ')}</dt>
              <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
          <div>
            <dt>Completed</dt>
            <dd>{formatWhen(row.completed_at)}</dd>
          </div>
        </dl>
      </div>
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

      <div className="jeweller-unified-desk-filters">
        <select
          className="jeweller-unified-desk-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="jeweller-unified-desk-select"
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          aria-label="Filter by method"
        >
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
          <span className="jeweller-unified-desk-summary">
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
        <div className="jeweller-purchases-wrap jeweller-unified-desk-scroll">
          <table className="jeweller-purchases-table jeweller-unified-desk-table">
            <thead>
              <tr>
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
                const orderRef = (row.detail.order_reference as string | undefined) || ''
                const metalRate = row.detail.metal_rate_inr_per_gram as string | undefined
                const reconScore = row.detail.reconciliation_score as number | undefined
                const utr =
                  row.otp_utr && row.otp_utr !== '—'
                    ? row.otp_utr
                    : (row.detail.upi_utr as string | undefined) || ''
                return (
                  <Fragment key={row.id}>
                    <tr className={isOpen ? 'jeweller-unified-desk-row--open' : undefined}>
                      <td data-label="Customer">
                        <div className="jeweller-purchases-customer-stack">
                          <strong className="jeweller-purchases-customer-name">
                            {row.customer.name || row.customer.email}
                          </strong>
                          <span className="jeweller-purchases-customer-email">{row.customer.email}</span>
                          {row.customer.member_id ? (
                            <span className="jeweller-purchases-member">{row.customer.member_id}</span>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Order">
                        <div className="jeweller-purchases-order-stack">
                          <button
                            type="button"
                            className="jeweller-unified-desk-order-toggle tabular"
                            aria-expanded={isOpen}
                            onClick={() => toggleExpanded(row.id)}
                          >
                            {row.reference}
                          </button>
                          {orderRef ? <span className="jeweller-purchases-order-ref">{orderRef}</span> : null}
                        </div>
                      </td>
                      <td data-label="Type">
                        <span className="jeweller-unified-type-pill">{typeLabel(row)}</span>
                      </td>
                      <td data-label="Amount">
                        <div className="jeweller-purchases-metal-stack">
                          <strong className="tabular">₹{formatInr(row.amount_inr)}</strong>
                          {row.grams && row.grams !== '0' ? (
                            <span>
                              {row.grams} g
                              {metalRate ? ` @ ₹${formatInr(metalRate)}/g` : ''}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Method">{methodLabel(row)}</td>
                      <td data-label="OTP / UTR">
                        {utr ? (
                          <strong className="tabular fractional-upi-utr-display">{utr}</strong>
                        ) : (
                          '—'
                        )}
                        {reconScore != null ? (
                          <span className="jeweller-unified-recon-score">{reconScore}% match</span>
                        ) : null}
                      </td>
                      <td data-label="Status">{row.status || statusLabel(row.status_raw)}</td>
                      <td data-label="Platform fee">
                        <strong className="tabular">{platformFeeDisplay(row.platform_fee_inr)}</strong>
                      </td>
                      {tab === 'pending' ? (
                        <td data-label="Actions" className="jeweller-purchases-otp-cell">
                          {renderActions(row)}
                        </td>
                      ) : null}
                    </tr>
                    {isOpen ? (
                      <tr className="jeweller-unified-desk-detail-row">
                        <td colSpan={tab === 'pending' ? 9 : 8}>{renderDetail(row)}</td>
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
