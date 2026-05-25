import { useCallback, useEffect, useState } from 'react'
import {
  fetchJewellerPortfolioLedger,
  type JewellerLoanCustomerSummaryDTO,
  type JewellerLedgerEntryDTO,
} from '@/lib/jewellerPortfolioLedgerApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { TablePagination } from '@/components/ui'
import { useTablePagination } from '@/hooks/useTablePagination'

function fmtInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function fmtWhen(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso.slice(0, 10)
  return new Date(t).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

function txnLabel(t: string): string {
  if (t.startsWith('revenue_')) return t.replace('revenue_', '').replace(/_/g, ' ')
  return t.replace(/_/g, ' ')
}

export function JewellerPortfolioLedgerSection() {
  const [filter, setFilter] = useState('all')
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchJewellerPortfolioLedger>>>(null)
  const [loadErr, setLoadErr] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const payload = await fetchJewellerPortfolioLedger(filter)
    if (!payload) {
      setLoadErr('Could not load portfolio ledger.')
      setData(null)
      return
    }
    setData(payload)
  }, [filter])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  const entries = data?.entries ?? []
  const customers = data?.loan_customers ?? []

  const customersPg = useTablePagination(customers.length, 10)
  const customersSlice = customersPg.active
    ? customers.slice(customersPg.sliceStart, customersPg.sliceEnd)
    : customers

  const entriesPg = useTablePagination(entries.length, 10)
  const entriesSlice = entriesPg.active ? entries.slice(entriesPg.sliceStart, entriesPg.sliceEnd) : entries

  return (
    <>
      <div className="pf-grid pf-grid--kpis pf-stagger" style={{ marginTop: '1rem' }}>
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--gold">
          <span className="pf-kpi__eyebrow">Total revenue</span>
          <p className="pf-kpi__value tabular">
            ₹{fmtInr(data?.revenue_summary?.total_revenue_inr ?? '0')}
          </p>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--iris">
          <span className="pf-kpi__eyebrow">Loan principal due</span>
          <p className="pf-kpi__value tabular">
            ₹{fmtInr(data?.loan_summary?.total_principal_outstanding_inr ?? '0')}
          </p>
          <span className="pf-kpi__hint">{data?.loan_summary?.active_loan_count ?? 0} active loans</span>
        </div>
      </div>

      {customers.length > 0 ? (
        <article className="pf-card pf-card--lift pf-card--wide" style={{ marginTop: '1rem' }}>
          <h3 className="pf-card__title">Loans by customer</h3>
          <p className="pf-card__meta">Outstanding principal and collateral per borrower.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
            {customersSlice.map((c: JewellerLoanCustomerSummaryDTO) => (
              <div
                key={c.customer_id}
                style={{
                  padding: '0.75rem',
                  borderRadius: 12,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--veil)',
                }}
              >
                <strong>{c.customer_label}</strong>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {c.active_count} active · {c.pending_count} pending · ₹
                  {fmtInr(c.total_principal_outstanding_inr)} due · {c.total_collateral_locked_grams} g locked
                </span>
              </div>
            ))}
          </div>
          {customersPg.active ? (
            <TablePagination
              page={customersPg.page}
              totalPages={customersPg.totalPages}
              totalItems={customers.length}
              pageSize={customersPg.pageSize}
              onPrev={() => customersPg.setPage((p) => Math.max(0, p - 1))}
              onNext={() => customersPg.setPage((p) => Math.min(customersPg.totalPages - 1, p + 1))}
              className="pf-ledger-pagination"
            />
          ) : null}
        </article>
      ) : null}

      <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger-table-wrap" style={{ marginTop: '1rem' }}>
        <header className="pf-card__head pf-ledger-head">
          <div>
            <h3 className="pf-card__title">Revenue &amp; activity ledger</h3>
            <p className="pf-card__meta">Sales, loan fees, loan repayments, and vault liability rows.</p>
          </div>
        </header>
        <div className="pf-ledger-filter" role="group" aria-label="Ledger filter">
          {(
            [
              ['all', 'All'],
              ['revenue', 'Revenue'],
              ['loan', 'Loans'],
              ['fractional_sale', 'Fractional'],
              ['loan_processing_fee', 'Loan fees'],
              ['ornament_sale', 'Ornaments'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-sm${filter === id ? ' btn-primary' : ' btn-ghost'}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {loadErr ? <p className="form-error">{loadErr}</p> : null}
        {entries.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No ledger rows for this filter.</p>
        ) : (
          <div className="pf-ledger-scroll">
            <table className="pf-ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Ref</th>
                  <th>Customer</th>
                  <th className="tabular">Grams</th>
                  <th className="tabular">₹</th>
                </tr>
              </thead>
              <tbody>
                {entriesSlice.map((e: JewellerLedgerEntryDTO, i: number) => (
                  <tr key={`${e.reference}-${entriesPg.sliceStart + i}`}>
                    <td>{fmtWhen(e.occurred_at)}</td>
                    <td>{txnLabel(e.transaction_type)}</td>
                    <td className="tabular">{e.reference}</td>
                    <td>{e.customer_label || '—'}</td>
                    <td className="tabular">{e.grams ? `${e.grams} g` : '—'}</td>
                    <td className="tabular">
                      {e.amount_inr ? `₹${fmtInr(e.amount_inr)}` : e.current_value_inr ? `₹${fmtInr(e.current_value_inr)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entriesPg.active ? (
              <TablePagination
                page={entriesPg.page}
                totalPages={entriesPg.totalPages}
                totalItems={entries.length}
                pageSize={entriesPg.pageSize}
                onPrev={() => entriesPg.setPage((p) => Math.max(0, p - 1))}
                onNext={() => entriesPg.setPage((p) => Math.min(entriesPg.totalPages - 1, p + 1))}
                className="pf-ledger-pagination"
              />
            ) : null}
          </div>
        )}
      </article>
    </>
  )
}
