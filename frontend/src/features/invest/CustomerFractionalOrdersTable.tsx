import { Fragment, useCallback, useState } from 'react'
import { Badge, Button } from '@/components/ui'
import { UpiOnHoldNotice } from '@/features/upi/UpiOnHoldNotice'
import { UpiPaymentStep } from '@/features/upi/UpiPaymentStep'
import { UpiProofTableCell } from '@/features/upi/UpiProofTableCell'
import {
  fetchUpiPayment,
  UPI_ON_HOLD,
  UPI_PENDING_REVIEW,
  UPI_PROOF_REJECTED,
  type UpiPaymentState,
} from '@/features/upi/upiPaymentApi'
import type { FractionalPurchaseDTO } from '@/lib/fractionalPurchaseApi'

type Props = {
  orders: FractionalPurchaseDTO[]
  busy: boolean
  setBusy: (v: boolean) => void
  otpRevealOrderId: number | null
  otpCountdownExpired: boolean
  onIssueOtp: (orderId: number) => void
  onRefreshOrders: () => Promise<void>
  onSuccess?: (message: string) => void
}

const UPI_DETAIL_STATUSES = new Set([
  'pending_payment',
  'signal_received',
  'pending_review',
  'proof_rejected',
  'on_hold',
  'needs_manual_verification',
  'awaiting_utr_verify',
])

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
  if (status === 'cancelled') return 'danger'
  if (status === 'on_hold') return 'danger'
  if (status === 'awaiting_counter' || status === 'awaiting_utr_verify') return 'gold'
  return 'warning'
}

function statusLabel(order: FractionalPurchaseDTO): string {
  if (order.status === 'on_hold') {
    return `On HOLD: Contact: ${(order.jeweller.business_name || 'JEWELLER').toUpperCase()}`
  }
  return order.status.replace(/_/g, ' ')
}

function rejectedSubmissions(state: UpiPaymentState | null) {
  return (state?.submissions ?? []).filter((s) => s.rejection_remark?.trim())
}

export function CustomerFractionalOrdersTable({
  orders,
  busy,
  setBusy,
  otpRevealOrderId,
  otpCountdownExpired,
  onIssueOtp,
  onRefreshOrders,
  onSuccess,
}: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [upiStateById, setUpiStateById] = useState<Record<number, UpiPaymentState>>({})
  const [loadErrById, setLoadErrById] = useState<Record<number, string>>({})

  const loadUpiDetail = useCallback(async (orderId: number) => {
    setLoadErrById((m) => ({ ...m, [orderId]: '' }))
    const out = await fetchUpiPayment('fractional', orderId)
    if (!out.ok) {
      setLoadErrById((m) => ({ ...m, [orderId]: out.detail }))
      return
    }
    setUpiStateById((m) => ({ ...m, [orderId]: out.data }))
  }, [])

  const toggle = (order: FractionalPurchaseDTO) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(order.id)) {
        next.delete(order.id)
      } else {
        next.add(order.id)
        if (order.payment_method === 'upi' && UPI_DETAIL_STATUSES.has(order.status)) {
          void loadUpiDetail(order.id)
        }
      }
      return next
    })
  }

  return (
    <div className="jeweller-purchases-wrap customer-orders-table-wrap">
      <table className="jeweller-purchases-table customer-orders-table">
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Jeweller</th>
            <th scope="col">Amount</th>
            <th scope="col">Method</th>
            <th scope="col">Status</th>
            <th scope="col">When</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const isOpen = expanded.has(o.id)
            const upiState = upiStateById[o.id]
            const loadErr = loadErrById[o.id]
            const rejections = rejectedSubmissions(upiState)
            return (
              <Fragment key={o.id}>
                <tr className={isOpen ? 'customer-orders-row--open' : undefined}>
                  <td data-label="Order">
                    <button
                      type="button"
                      className="jeweller-unified-desk-order-toggle tabular"
                      aria-expanded={isOpen}
                      onClick={() => toggle(o)}
                    >
                      {o.reference}
                    </button>
                  </td>
                  <td data-label="Jeweller">{o.jeweller.business_name}</td>
                  <td data-label="Amount">
                    <strong className="tabular">₹{formatInr(o.total_inr)}</strong>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {o.grams} g
                    </span>
                  </td>
                  <td data-label="Method">{o.payment_method}</td>
                  <td data-label="Status">
                    <Badge tone={statusTone(o.status)}>{statusLabel(o)}</Badge>
                  </td>
                  <td data-label="When">{formatWhen(o.created_at)}</td>
                </tr>
                {isOpen ? (
                  <tr className="customer-orders-detail-row">
                    <td colSpan={6}>
                      <div className="customer-orders-detail">
                        {loadErr ? <p className="form-error">{loadErr}</p> : null}

                        {o.payment_method === 'upi' && upiState ? (
                          <>
                            {upiState.status === UPI_ON_HOLD ? (
                              <>
                                <UpiOnHoldNotice kind="fractional" contactName={o.jeweller.business_name} />
                                {rejections.length > 0 ? (
                                  <div className="customer-orders-rejection-history">
                                    <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.85rem' }}>
                                      Reviewer responses
                                    </p>
                                    <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem' }}>
                                      {rejections.map((s, idx) => (
                                        <li key={s.id} style={{ marginBottom: '0.35rem' }}>
                                          <strong>Response {idx + 1}:</strong> {s.rejection_remark}
                                          {s.utr ? (
                                            <>
                                              {' '}
                                              · UTR <span className="tabular">{s.utr}</span>
                                            </>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                ) : null}
                              </>
                            ) : null}

                            {upiState.status === UPI_PROOF_REJECTED ? (
                              <>
                                {rejections.length > 0 ? (
                                  <div className="customer-orders-rejection-history">
                                    <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.85rem' }}>
                                      Rejection history
                                    </p>
                                    <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem' }}>
                                      {rejections.map((s, idx) => (
                                        <li key={s.id} style={{ marginBottom: '0.35rem' }}>
                                          <strong>Attempt {idx + 1}:</strong> {s.rejection_remark}
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                ) : null}
                                <UpiPaymentStep
                                  kind="fractional"
                                  paymentId={o.id}
                                  busy={busy}
                                  setBusy={setBusy}
                                  onSubmitted={() => void onRefreshOrders()}
                                  onSuccess={onSuccess}
                                />
                              </>
                            ) : null}

                            {upiState.status === UPI_PENDING_REVIEW ? (
                              <div className="customer-orders-status-card" role="status">
                                <p style={{ margin: 0, fontWeight: 700 }}>Pending jeweller review</p>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                  Your proof was submitted and is awaiting approval.
                                </p>
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
                                kind="fractional"
                                paymentId={o.id}
                                busy={busy}
                                setBusy={setBusy}
                                onSubmitted={() => void onRefreshOrders()}
                                onSuccess={onSuccess}
                              />
                            )}
                          </>
                        ) : null}

                        {o.status === 'awaiting_counter' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            block
                            disabled={busy || (otpRevealOrderId === o.id && !otpCountdownExpired)}
                            onClick={() => onIssueOtp(o.id)}
                          >
                            {otpRevealOrderId === o.id && otpCountdownExpired
                              ? 'Generate new OTP'
                              : otpRevealOrderId === o.id && !otpCountdownExpired
                                ? 'OTP active'
                                : 'Generate OTP'}
                          </Button>
                        ) : null}

                        {o.customer_note ? (
                          <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Note: {o.customer_note}
                          </p>
                        ) : null}
                        {o.jeweller_verified_at ? (
                          <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Completed {formatWhen(o.jeweller_verified_at)}
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
    </div>
  )
}
