import { Fragment, useCallback, useMemo, useState } from 'react'
import { Badge, Button, TablePagination } from '@/components/ui'
import { useTablePagination } from '@/hooks/useTablePagination'
import {
  cancelCustomerPendingPayment,
  issueCustomerCounterOtp,
  type CounterOtpReveal,
} from '@/features/invest/customerPaymentFlow'
import { UpiOnHoldNotice } from '@/features/upi/UpiOnHoldNotice'
import { UpiPaymentStep } from '@/features/upi/UpiPaymentStep'
import { UpiProofTableCell } from '@/features/upi/UpiProofTableCell'
import {
  fetchUpiPayment,
  UPI_AUTO_CANCEL_STATUSES,
  UPI_ON_HOLD,
  UPI_PENDING_REVIEW,
  UPI_PROOF_REJECTED,
  type UpiPaymentState,
} from '@/features/upi/upiPaymentApi'
import type { SchemeContributionDTO } from '@/lib/schemesApi'
import { MobileDashboardCancelButton } from '@/features/dashboard/MobileDashboardCancelButton'

const PAGE_SZ = 10

const UPI_DETAIL_STATUSES = new Set([
  'pending_payment',
  'signal_received',
  'pending_review',
  'proof_rejected',
  'on_hold',
  'needs_manual_verification',
  'awaiting_utr_verify',
])

type Props = {
  contributions: SchemeContributionDTO[]
  busy: boolean
  setBusy: (v: boolean) => void
  otpRevealId: number | null
  otpCountdownExpired: boolean
  onRefresh: () => Promise<void>
  onSuccess?: (message: string) => void
}

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

function statusTone(status: string): 'success' | 'danger' | 'gold' | 'warning' {
  if (status === 'completed') return 'success'
  if (status === 'cancelled' || status === 'rejected' || status === 'on_hold') return 'danger'
  if (status === 'awaiting_counter' || status === 'awaiting_utr_verify') return 'gold'
  return 'warning'
}

function formatMethod(method: string): string {
  if (method === 'upi') return 'UPI'
  if (method === 'counter') return 'Counter'
  return method.replace(/_/g, ' ')
}

function statusLabel(row: SchemeContributionDTO): string {
  if (row.status === 'on_hold') {
    return `On HOLD: Contact: ${(row.jeweller_name || 'JEWELLER').toUpperCase()}`
  }
  return row.status.replace(/_/g, ' ')
}

function canCancel(row: SchemeContributionDTO): boolean {
  if (row.payment_method === 'upi' && UPI_AUTO_CANCEL_STATUSES.has(row.status)) return true
  if (row.payment_method === 'counter' && row.status === 'awaiting_counter') return true
  return false
}

export function CustomerSchemeContributionsTable({
  contributions,
  busy,
  setBusy,
  otpRevealId,
  otpCountdownExpired,
  onRefresh,
  onSuccess,
}: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [upiStateById, setUpiStateById] = useState<Record<number, UpiPaymentState>>({})
  const [loadErrById, setLoadErrById] = useState<Record<number, string>>({})
  const [cancelErrById, setCancelErrById] = useState<Record<number, string>>({})
  const [otpReveal, setOtpReveal] = useState<CounterOtpReveal | null>(null)
  const pg = useTablePagination(contributions.length, PAGE_SZ)
  const pageRows = pg.active ? contributions.slice(pg.sliceStart, pg.sliceEnd) : contributions

  const issueOtp = useCallback(
    async (id: number) => {
      setBusy(true)
      try {
        const out = await issueCustomerCounterOtp('scheme', id)
        if (!out.ok) return
        setOtpReveal(out.data)
      } finally {
        setBusy(false)
        await onRefresh()
      }
    },
    [onRefresh, setBusy],
  )

  const cancelRow = useCallback(
    async (row: SchemeContributionDTO) => {
      setCancelErrById((m) => ({ ...m, [row.id]: '' }))
      setBusy(true)
      try {
        const out = await cancelCustomerPendingPayment('scheme', row)
        if (!out.ok) {
          setCancelErrById((m) => ({ ...m, [row.id]: out.detail }))
          return
        }
        onSuccess?.(out.data.detail)
        await onRefresh()
      } finally {
        setBusy(false)
      }
    },
    [onRefresh, onSuccess, setBusy],
  )

  const loadUpiDetail = useCallback(async (id: number) => {
    setLoadErrById((m) => ({ ...m, [id]: '' }))
    const out = await fetchUpiPayment('scheme', id)
    if (!out.ok) {
      setLoadErrById((m) => ({ ...m, [id]: out.detail }))
      return
    }
    setUpiStateById((m) => ({ ...m, [id]: out.data }))
  }, [])

  const toggle = (row: SchemeContributionDTO) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(row.id)) {
        next.delete(row.id)
      } else {
        next.add(row.id)
        if (row.payment_method === 'upi' && UPI_DETAIL_STATUSES.has(row.status)) {
          void loadUpiDetail(row.id)
        }
      }
      return next
    })
  }

  const activeOtp = useMemo(() => {
    if (otpReveal) return otpReveal
    if (otpRevealId == null) return null
    return { paymentId: otpRevealId, otp: '', expiresAt: '' }
  }, [otpReveal, otpRevealId])

  if (contributions.length === 0) {
    return <p style={{ color: 'var(--text-faint)', margin: 0, fontSize: 'var(--ts-sm)' }}>No deposits yet.</p>
  }

  return (
    <div className="jeweller-purchases-wrap customer-orders-table-wrap">
      <table className="jeweller-purchases-table customer-orders-table">
        <thead>
          <tr>
            <th scope="col">Deposit</th>
            <th scope="col">Scheme</th>
            <th scope="col">Gold</th>
            <th scope="col">Amount</th>
            <th scope="col">Method</th>
            <th scope="col">Status</th>
            <th scope="col">When</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => {
            const isOpen = expanded.has(row.id)
            const upiState = upiStateById[row.id]
            const loadErr = loadErrById[row.id]
            const cancelErr = cancelErrById[row.id]
            const showCancel = canCancel(row)
            return (
              <Fragment key={row.id}>
                <tr className={isOpen ? 'customer-orders-row--open' : undefined}>
                  <td data-label="Deposit">
                    <button
                      type="button"
                      className="jeweller-unified-desk-order-toggle tabular"
                      aria-expanded={isOpen}
                      onClick={() => toggle(row)}
                    >
                      {row.reference}
                    </button>
                  </td>
                  <td data-label="Scheme">
                    <strong>{row.scheme_name ?? 'Scheme'}</strong>
                    {row.jeweller_name ? (
                      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {row.jeweller_name}
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Gold">
                    <strong className="tabular">{row.gold_grams} g</strong>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {row.calendar_month} · #{row.deposit_sequence_in_month}
                    </span>
                  </td>
                  <td data-label="Amount">
                    <strong className="tabular">₹{formatInr(row.amount_inr)}</strong>
                  </td>
                  <td data-label="Method">{formatMethod(row.payment_method)}</td>
                  <td data-label="Status">
                    <Badge tone={statusTone(row.status)}>{statusLabel(row)}</Badge>
                    {showCancel ? (
                      <div className="customer-orders-mobile-actions">
                        {cancelErr ? <p className="form-error">{cancelErr}</p> : null}
                        <MobileDashboardCancelButton
                          block
                          busy={busy}
                          confirmMessage="Cancel this deposit? You can place a new one later."
                          onCancel={() => cancelRow(row)}
                        />
                      </div>
                    ) : null}
                  </td>
                  <td data-label="When">
                    {formatWhen(row.created_at)}
                    {row.jeweller_verified_at ? (
                      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Done {formatWhen(row.jeweller_verified_at)}
                      </span>
                    ) : null}
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="customer-orders-detail-row">
                    <td colSpan={7}>
                      <div className="customer-orders-detail">
                        {loadErr ? <p className="form-error">{loadErr}</p> : null}

                        {row.payment_method === 'upi' && upiState ? (
                          <>
                            {upiState.status === UPI_ON_HOLD ? (
                              <UpiOnHoldNotice kind="scheme" contactName={row.jeweller_name} />
                            ) : null}
                            {upiState.status === UPI_PROOF_REJECTED ? (
                              <UpiPaymentStep
                                kind="scheme"
                                paymentId={row.id}
                                busy={busy}
                                setBusy={setBusy}
                                onSubmitted={() => void onRefresh()}
                                onSuccess={onSuccess}
                              />
                            ) : null}
                            {upiState.status === UPI_PENDING_REVIEW ? (
                              <div className="customer-orders-status-card" role="status">
                                <p style={{ margin: 0, fontWeight: 700 }}>Pending jeweller review</p>
                                <div style={{ marginTop: '0.65rem' }}>
                                  <UpiProofTableCell
                                    utr={upiState.upi_utr}
                                    proofFileUrl={upiState.proof_file_url}
                                  />
                                </div>
                              </div>
                            ) : null}
                            {(upiState.status === 'pending_payment' ||
                              upiState.status === 'signal_received' ||
                              upiState.status === 'needs_manual_verification') && (
                              <UpiPaymentStep
                                kind="scheme"
                                paymentId={row.id}
                                busy={busy}
                                setBusy={setBusy}
                                onSubmitted={() => void onRefresh()}
                                onSuccess={onSuccess}
                              />
                            )}
                          </>
                        ) : null}

                        {row.status === 'awaiting_counter' ? (
                          <>
                            {activeOtp?.paymentId === row.id && otpReveal?.otp ? (
                              <p className="ds-feedback ds-feedback--success" role="status">
                                OTP <strong className="tabular">{otpReveal.otp}</strong> — show at counter
                              </p>
                            ) : null}
                            <Button
                              type="button"
                              variant="secondary"
                              block
                              disabled={
                                busy ||
                                (activeOtp?.paymentId === row.id && !otpCountdownExpired && Boolean(otpReveal?.otp))
                              }
                              onClick={() => void issueOtp(row.id)}
                            >
                              {activeOtp?.paymentId === row.id && otpCountdownExpired
                                ? 'Generate new OTP'
                                : activeOtp?.paymentId === row.id && otpReveal?.otp
                                  ? 'OTP active'
                                  : 'Generate OTP'}
                            </Button>
                          </>
                        ) : null}

                        {row.customer_note ? (
                          <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Note: {row.customer_note}
                          </p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {pg.active ? (
        <TablePagination
          page={pg.page}
          totalPages={pg.totalPages}
          totalItems={contributions.length}
          pageSize={pg.pageSize}
          onPrev={() => pg.setPage((p) => Math.max(0, p - 1))}
          onNext={() => pg.setPage((p) => Math.min(pg.totalPages - 1, p + 1))}
          className="pf-ledger-pagination"
        />
      ) : null}
    </div>
  )
}
