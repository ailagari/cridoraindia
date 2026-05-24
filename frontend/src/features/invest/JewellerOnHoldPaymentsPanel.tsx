import { Fragment, useCallback, useEffect, useState } from 'react'
import { UpiProofTableCell } from '@/features/upi/UpiProofTableCell'
import { approveUpiPayment, type UpiPaymentKind } from '@/features/upi/upiPaymentApi'
import {
  jewellerOnHoldPayments,
  rowSubmissions,
  upiKindFromRow,
} from '@/lib/jewellerOnHoldApi'
import type { UnifiedDeskRow } from '@/lib/jewellerUnifiedDeskApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatWhen(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

export function JewellerOnHoldPaymentsPanel() {
  const [rows, setRows] = useState<UnifiedDeskRow[]>([])
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    setErr('')
    const out = await jewellerOnHoldPayments({ limit: 100 })
    if (!out.ok) {
      setErr(out.detail)
      setRows([])
      return
    }
    setRows(out.data.results)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyId == null)

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const approve = async (row: UnifiedDeskRow, kind: UpiPaymentKind) => {
    setBusyId(row.id)
    setErr('')
    setSuccess('')
    try {
      const out = await approveUpiPayment(kind, row.source_id)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setSuccess(`${row.reference} approved after in-person verification.`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="dash-panel-max jeweller-on-hold-panel">
      <p className="dash-panel-lead">
        UPI payments on hold after two rejected proofs. Meet the customer in person, verify payment, then approve
        here.
      </p>

      {success ? (
        <p className="admin-dash-form-success admin-dash-form-success--block" role="status">
          {success}
        </p>
      ) : null}
      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No on-hold UPI payments.</p>
      ) : (
        <div className="jeweller-purchases-wrap jeweller-unified-desk-scroll">
          <table className="jeweller-purchases-table jeweller-unified-desk-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Order</th>
                <th scope="col">Type</th>
                <th scope="col">Amount</th>
                <th scope="col">Payment proof</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOpen = expanded.has(row.id)
                const kind = upiKindFromRow(row)
                const submissions = rowSubmissions(row)
                const rejections = submissions.filter((s) => s.rejection_remark?.trim())
                const utr =
                  (row.detail.upi_utr as string | undefined) ||
                  (row.otp_utr !== '—' ? row.otp_utr : '')
                const proofUrl = row.detail.proof_file_url as string | undefined
                return (
                  <Fragment key={row.id}>
                    <tr className={isOpen ? 'jeweller-unified-desk-row--open' : undefined}>
                      <td data-label="Customer">
                        <strong>{row.customer.name || row.customer.email}</strong>
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {row.customer.email}
                        </span>
                      </td>
                      <td data-label="Order">
                        <button
                          type="button"
                          className="jeweller-unified-desk-order-toggle tabular"
                          aria-expanded={isOpen}
                          onClick={() => toggle(row.id)}
                        >
                          {row.reference}
                        </button>
                      </td>
                      <td data-label="Type">{row.type_label || row.transaction_type}</td>
                      <td data-label="Amount">
                        <strong className="tabular">₹{formatInr(row.amount_inr)}</strong>
                      </td>
                      <td data-label="Payment proof">
                        <UpiProofTableCell utr={utr} proofFileUrl={proofUrl} />
                      </td>
                      <td data-label="Actions">
                        {kind ? (
                          <button
                            type="button"
                            className="btn btn-primary jeweller-purchases-verify-btn"
                            disabled={busyId != null}
                            onClick={() => void approve(row, kind)}
                          >
                            {busyId === row.id ? 'Approving…' : 'Approve in person'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="jeweller-unified-desk-detail-row">
                        <td colSpan={6}>
                          <div className="jeweller-unified-desk-detail">
                            <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: 'var(--danger)' }}>
                              On HOLD — visit customer to verify
                            </p>
                            {rejections.length > 0 ? (
                              <div className="customer-orders-rejection-history">
                                <p style={{ margin: '0 0 0.45rem', fontSize: '0.85rem', fontWeight: 700 }}>
                                  Customer proof attempts
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
                                      <span style={{ color: 'var(--text-muted)' }}>
                                        {' '}
                                        · {formatWhen(s.submitted_at)}
                                      </span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ) : (
                              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                Rejection count: {String(row.detail.upi_rejection_count ?? '—')}
                                {row.detail.upi_last_rejection_remark ? (
                                  <>
                                    {' '}
                                    · Last remark: {String(row.detail.upi_last_rejection_remark)}
                                  </>
                                ) : null}
                              </p>
                            )}
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
      )}
    </div>
  )
}
