import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchJewellerLoanDashboard,
  type JewellerLoanBookRowDTO,
  type JewellerLoanDashboardDTO,
} from '@/lib/jewellerLoanDashboardApi'
import {
  postJewellerLoanAccept,
  postJewellerLoanComplete,
  postJewellerLoanReject,
  postJewellerLoanRepaymentAccept,
  postJewellerLoanRepaymentComplete,
  postJewellerLoanRepaymentReject,
} from '@/lib/goldLoanApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

type TabId = 'loans' | 'ledger' | 'customers'
type LoanFilter = 'all' | 'active' | 'completed' | 'pending'

function fmtInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function fmtWhen(iso: string): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleDateString('en-IN')
}

function statusLabel(st: string): string {
  if (st === 'pending_jeweller') return 'Pending disbursement'
  if (st === 'accepted_awaiting_otp') return 'Awaiting disbursement OTP'
  if (st === 'disbursed') return 'Active'
  if (st === 'repaid') return 'Completed · collateral released'
  if (st === 'rejected') return 'Rejected'
  return st.replace(/_/g, ' ')
}

function statusTone(st: string): string {
  if (st === 'disbursed') return 'var(--warning)'
  if (st === 'repaid') return 'var(--success)'
  if (st === 'pending_jeweller' || st === 'accepted_awaiting_otp') return 'var(--gold-light)'
  return 'var(--text-muted)'
}

function loanMatchesFilter(loan: JewellerLoanBookRowDTO, filter: LoanFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'active') return loan.status === 'disbursed'
  if (filter === 'completed') return loan.status === 'repaid'
  if (filter === 'pending') {
    return loan.status === 'pending_jeweller' || loan.status === 'accepted_awaiting_otp'
  }
  return true
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      className="card"
      style={{
        padding: '0.85rem 1rem',
        borderRadius: 14,
        border: '1px solid var(--border-soft)',
        background: 'var(--veil)',
        minWidth: 0,
      }}
    >
      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p className="tabular" style={{ margin: '0.25rem 0 0', fontSize: '1.15rem', fontWeight: 700 }}>
        {value}
      </p>
      {hint ? (
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>{hint}</p>
      ) : null}
    </div>
  )
}

function LoanDetailCard({ loan }: { loan: JewellerLoanBookRowDTO }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        padding: '0.85rem 1rem',
        marginBottom: '0.65rem',
        borderRadius: 12,
        border: '1px solid var(--border-soft)',
        background: 'var(--veil)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div>
            <strong className="tabular">{loan.reference}</strong>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>{loan.customer_label}</span>
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: statusTone(loan.status) }}>
            {statusLabel(loan.status)}
          </span>
        </div>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <span className="tabular">{loan.grams} g</span> pledged · ₹{fmtInr(loan.net_disbursement_inr)} cash
          disbursed
          {loan.disbursed_at ? ` · ${fmtDate(loan.disbursed_at)}` : ` · requested ${fmtDate(loan.created_at)}`}
          {loan.due_at ? ` · due ${fmtDate(loan.due_at)}` : ''}
        </p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem' }}>
          Principal: ₹{fmtInr(loan.gross_principal_inr)} · Paid ₹{fmtInr(loan.principal_paid_inr)} · Outstanding{' '}
          <strong className="tabular">₹{fmtInr(loan.principal_outstanding_inr)}</strong>
          {parseFloat(loan.collateral_locked_grams) > 0 ? (
            <>
              {' '}
              · <span className="tabular">{loan.collateral_locked_grams} g</span> locked
            </>
          ) : null}
        </p>
      </button>
      {open ? (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-soft)' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Collateral value ₹{fmtInr(loan.collateral_value_inr)} · LTV {loan.ltv_percent}% · Term{' '}
            {loan.term_months} mo · Processing fee ₹{fmtInr(loan.processing_fee_inr)}
          </p>
          {loan.collateral_released === 'true' ? (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--success)' }}>
              Full repayment received. Pledged gold released back to customer vault holdings.
            </p>
          ) : null}
          {loan.open_repayment_request ? (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--warning)' }}>
              Open repayment {loan.open_repayment_request.reference} · ₹
              {fmtInr(loan.open_repayment_request.amount_inr)} ·{' '}
              {loan.open_repayment_request.status.replace(/_/g, ' ')}
            </p>
          ) : null}
          <p style={{ margin: '0 0 0.35rem', fontSize: '0.78rem', fontWeight: 600 }}>Repayment history</p>
          {loan.repayments.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-faint)' }}>No repayments recorded yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem' }}>
              {loan.repayments.map((r) => (
                <li key={r.id} style={{ marginBottom: '0.25rem' }}>
                  {fmtWhen(r.created_at)} · ₹{fmtInr(r.amount_inr)} · balance after ₹
                  {fmtInr(r.principal_after_inr)}
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--text-faint)' }}>
            Total repaid on this loan: ₹{fmtInr(loan.total_repaid_inr)}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function JewellerLoanDashboardPanel() {
  const [data, setData] = useState<JewellerLoanDashboardDTO | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [tab, setTab] = useState<TabId>('loans')
  const [loanFilter, setLoanFilter] = useState<LoanFilter>('all')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [disburseOtp, setDisburseOtp] = useState<Record<number, string>>({})
  const [repayOtp, setRepayOtp] = useState<Record<number, string>>({})

  const refresh = useCallback(async () => {
    setLoadErr('')
    const payload = await fetchJewellerLoanDashboard()
    if (!payload) {
      setLoadErr('Could not load loan dashboard.')
      setData(null)
      return
    }
    setData(payload)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  const filteredLoans = useMemo(() => {
    if (!data) return []
    return data.loans.filter((l) => loanMatchesFilter(l, loanFilter))
  }, [data, loanFilter])

  const hasActions =
    (data?.pending_disbursements.length ?? 0) > 0 || (data?.pending_repayments.length ?? 0) > 0

  const runDisburseAccept = async (id: number) => {
    setBusyId(id)
    const out = await postJewellerLoanAccept(id)
    setBusyId(null)
    if (!out.ok) {
      setLoadErr(out.detail)
      return
    }
    setSuccessMsg(out.detail)
    await refresh()
  }

  const runDisburseReject = async (id: number) => {
    setBusyId(id)
    const out = await postJewellerLoanReject(id)
    setBusyId(null)
    if (!out.ok) {
      setLoadErr(out.detail)
      return
    }
    await refresh()
  }

  const runDisburseComplete = async (id: number) => {
    const otp = (disburseOtp[id] ?? '').trim()
    if (!otp) {
      setLoadErr('Enter the customer\'s 6-digit OTP to disburse.')
      return
    }
    setBusyId(id)
    const out = await postJewellerLoanComplete(id, otp)
    setBusyId(null)
    if (!out.ok) {
      setLoadErr(out.detail)
      return
    }
    setSuccessMsg(out.detail)
    setDisburseOtp((d) => {
      const n = { ...d }
      delete n[id]
      return n
    })
    await refresh()
  }

  const runRepayAccept = async (id: number) => {
    setBusyId(id)
    const out = await postJewellerLoanRepaymentAccept(id)
    setBusyId(null)
    if (!out.ok) {
      setLoadErr(out.detail)
      return
    }
    setSuccessMsg(out.detail)
    await refresh()
  }

  const runRepayReject = async (id: number) => {
    setBusyId(id)
    const out = await postJewellerLoanRepaymentReject(id)
    setBusyId(null)
    if (!out.ok) {
      setLoadErr(out.detail)
      return
    }
    await refresh()
  }

  const runRepayComplete = async (id: number) => {
    const otp = (repayOtp[id] ?? '').trim()
    if (!otp) {
      setLoadErr('Enter the customer\'s 6-digit OTP to record repayment.')
      return
    }
    setBusyId(id)
    const out = await postJewellerLoanRepaymentComplete(id, otp)
    setBusyId(null)
    if (!out.ok) {
      setLoadErr(out.detail)
      return
    }
    setSuccessMsg(out.detail)
    setRepayOtp((d) => {
      const n = { ...d }
      delete n[id]
      return n
    })
    await refresh()
  }

  const s = data?.summary

  return (
    <div className="pf-scope">
      <h2 className="dash-panel-title">Gold loans</h2>
      <p className="dash-panel-lead">
        Track cash disbursed against pledged vault gold, customer repayments, outstanding balances, and completed
        loans. When a loan is fully repaid, collateral is released back to the customer&apos;s vault holdings.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}
      {successMsg ? (
        <p style={{ margin: '0 0 1rem', color: 'var(--success)', fontWeight: 600 }} role="status">
          {successMsg}
        </p>
      ) : null}

      {s ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(10.5rem, 1fr))',
            gap: '0.65rem',
            marginBottom: '1.25rem',
          }}
        >
          <KpiCard label="Outstanding" value={`₹${fmtInr(s.total_principal_outstanding_inr)}`} />
          <KpiCard label="Active loans" value={s.active_loan_count} />
          <KpiCard label="Completed" value={s.repaid_loan_count} hint="Collateral released" />
          <KpiCard label="Total repaid" value={`₹${fmtInr(s.total_principal_repaid_inr)}`} />
          <KpiCard label="Cash disbursed" value={`₹${fmtInr(s.total_net_cash_disbursed_inr)}`} />
          <KpiCard
            label="Collateral locked"
            value={`${Number.parseFloat(s.total_collateral_locked_grams).toFixed(3)} g`}
          />
        </div>
      ) : null}

      {hasActions ? (
        <div
          className="card"
          style={{
            marginBottom: '1.25rem',
            padding: '1rem',
            borderRadius: 16,
            border: '1px solid rgba(245, 158, 11, 0.35)',
            background: 'rgba(245, 158, 11, 0.06)',
          }}
        >
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Needs action</h3>
          {(data?.pending_disbursements.length ?? 0) > 0 ? (
            <>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                New loan requests — pay customer cash, then verify OTP to disburse.
              </p>
              {data!.pending_disbursements.map((loan) => (
                <div
                  key={loan.id}
                  style={{
                    padding: '0.65rem 0.75rem',
                    marginBottom: '0.5rem',
                    borderRadius: 10,
                    border: '1px solid var(--border-soft)',
                    background: 'var(--veil)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    <strong>{loan.reference}</strong> · {loan.customer_label} ·{' '}
                    <span className="tabular">{loan.grams} g</span> · ₹{fmtInr(loan.net_disbursement_inr)}
                  </p>
                  <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.78rem', color: statusTone(loan.status) }}>
                    {statusLabel(loan.status)}
                  </p>
                  {loan.status === 'pending_jeweller' ? (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.68rem' }}
                        disabled={busyId === loan.id}
                        onClick={() => void runDisburseAccept(loan.id)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: '0.68rem' }}
                        disabled={busyId === loan.id}
                        onClick={() => void runDisburseReject(loan.id)}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Customer OTP"
                        maxLength={6}
                        className="tabular"
                        value={disburseOtp[loan.id] ?? ''}
                        disabled={busyId === loan.id}
                        onChange={(e) =>
                          setDisburseOtp((d) => ({
                            ...d,
                            [loan.id]: e.target.value.replace(/\D/g, '').slice(0, 6),
                          }))
                        }
                        style={{
                          width: '7rem',
                          padding: '0.35rem',
                          borderRadius: 8,
                          border: '1px solid var(--border-soft)',
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.68rem' }}
                        disabled={busyId === loan.id}
                        onClick={() => void runDisburseComplete(loan.id)}
                      >
                        Disburse (verify OTP)
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : null}
          {(data?.pending_repayments.length ?? 0) > 0 ? (
            <>
              <p
                style={{
                  margin: '0.75rem 0 0.5rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                }}
              >
                Repayment requests — collect cash, then verify customer OTP.
              </p>
              {data!.pending_repayments.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: '0.65rem 0.75rem',
                    marginBottom: '0.5rem',
                    borderRadius: 10,
                    border: '1px solid var(--border-soft)',
                    background: 'var(--veil)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    <strong>{r.reference}</strong> · {r.loan_reference} · {r.customer_label} · ₹
                    {fmtInr(r.amount_inr)}
                  </p>
                  <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.78rem' }}>
                    Loan balance ₹{fmtInr(r.principal_outstanding_inr)} · {r.status.replace(/_/g, ' ')}
                  </p>
                  {r.status === 'pending_jeweller' ? (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.68rem' }}
                        disabled={busyId === r.id}
                        onClick={() => void runRepayAccept(r.id)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: '0.68rem' }}
                        disabled={busyId === r.id}
                        onClick={() => void runRepayReject(r.id)}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Customer OTP"
                        maxLength={6}
                        className="tabular"
                        value={repayOtp[r.id] ?? ''}
                        disabled={busyId === r.id}
                        onChange={(e) =>
                          setRepayOtp((d) => ({
                            ...d,
                            [r.id]: e.target.value.replace(/\D/g, '').slice(0, 6),
                          }))
                        }
                        style={{
                          width: '7rem',
                          padding: '0.35rem',
                          borderRadius: 8,
                          border: '1px solid var(--border-soft)',
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.68rem' }}
                        disabled={busyId === r.id}
                        onClick={() => void runRepayComplete(r.id)}
                      >
                        Record repayment
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {(['loans', 'ledger', 'customers'] as TabId[]).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
            onClick={() => setTab(t)}
          >
            {t === 'loans' ? 'All loans' : t === 'ledger' ? 'Repayment ledger' : 'By customer'}
          </button>
        ))}
      </div>

      {tab === 'loans' ? (
        <>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
            {(['all', 'active', 'completed', 'pending'] as LoanFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={loanFilter === f ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ fontSize: '0.72rem', padding: '0.28rem 0.5rem' }}
                onClick={() => setLoanFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'active' ? 'Active' : f === 'completed' ? 'Completed' : 'Pending'}
              </button>
            ))}
          </div>
          {filteredLoans.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No loans in this view.</p>
          ) : (
            filteredLoans.map((loan) => <LoanDetailCard key={loan.id} loan={loan} />)
          )}
        </>
      ) : null}

      {tab === 'ledger' ? (
        <div className="jeweller-sellbacks-wrap">
          <table className="jeweller-sellbacks-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Type</th>
                <th scope="col">Ref</th>
                <th scope="col">Customer</th>
                <th scope="col">Amount ₹</th>
                <th scope="col">Balance ₹</th>
              </tr>
            </thead>
            <tbody>
              {(data?.repayment_ledger ?? []).map((row, i) => (
                <tr key={`${row.reference}-${i}`}>
                  <td data-label="When">{fmtWhen(row.occurred_at)}</td>
                  <td data-label="Type">{row.label}</td>
                  <td data-label="Ref">
                    <span className="tabular">{row.reference}</span>
                  </td>
                  <td data-label="Customer">{row.customer_label}</td>
                  <td data-label="Amount">
                    {row.amount_inr ? <span className="tabular">₹{fmtInr(row.amount_inr)}</span> : '—'}
                  </td>
                  <td data-label="Balance">
                    {row.principal_outstanding_inr ? (
                      <span className="tabular">₹{fmtInr(row.principal_outstanding_inr)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.repayment_ledger.length ?? 0) === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
              No loan activity yet.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'customers' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(data?.customers ?? []).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No customer loans yet.</p>
          ) : (
            data!.customers.map((c) => (
              <div
                key={c.customer_id}
                className="card"
                style={{ padding: '0.85rem 1rem', borderRadius: 12, border: '1px solid var(--border-soft)' }}
              >
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {c.customer_label}
                  {c.customer_member_id ? (
                    <span style={{ marginLeft: '0.35rem', fontSize: '0.78rem', color: 'var(--text-faint)' }}>
                      {c.customer_member_id}
                    </span>
                  ) : null}
                </p>
                <p style={{ margin: '0.35rem 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {c.active_count} active · {c.pending_count} pending · Outstanding ₹
                  {fmtInr(c.total_principal_outstanding_inr)} ·{' '}
                  <span className="tabular">{c.total_collateral_locked_grams} g</span> locked
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem' }}>
                  {c.loans.map((l) => (
                    <li key={l.id} style={{ marginBottom: '0.2rem' }}>
                      {l.reference} · {statusLabel(l.status)} · ₹{fmtInr(l.principal_outstanding_inr)} due
                      {l.due_at ? ` · ${fmtDate(l.due_at)}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
