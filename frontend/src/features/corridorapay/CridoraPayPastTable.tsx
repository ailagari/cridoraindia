import type { CridoraPayLedgerEntryDTO } from '@/lib/cridorapayApi'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatWhen(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso.slice(0, 10)
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function statusLabel(s: string): string {
  if (s === 'completed') return 'Complete'
  if (s === 'cancelled') return 'Cancelled'
  if (s === 'expired') return 'Expired'
  return s
}

type Props = {
  entries: CridoraPayLedgerEntryDTO[]
  counterpartyHeader: 'Jeweller' | 'Customer'
  emptyMessage: string
  error?: string
  meta: string
}

export function CridoraPayPastTable({ entries, counterpartyHeader, emptyMessage, error, meta }: Props) {
  return (
    <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger-table-wrap" style={{ marginTop: '1.5rem' }}>
      <header className="pf-card__head pf-ledger-head">
        <div>
          <h3 className="pf-card__title">Past CridoraPay</h3>
          <p className="pf-card__meta">{meta}</p>
        </div>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {entries.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', padding: '0 1rem 1rem', margin: 0 }}>{emptyMessage}</p>
      ) : (
        <div className="pf-ledger-scroll">
          <table className="pf-ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Item</th>
                <th>{counterpartyHeader}</th>
                <th>Status</th>
                <th className="tabular">Grams</th>
                <th className="tabular">₹</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={`${row.reference}-${row.occurred_at}`} className="pf-ledger-row">
                  <td className="pf-ledger-date">{formatWhen(row.occurred_at)}</td>
                  <td className="tabular">{row.reference}</td>
                  <td>{row.label}</td>
                  <td>{row.counterparty_label || '—'}</td>
                  <td>{statusLabel(row.status)}</td>
                  <td className="tabular pf-ledger-grams">{row.grams} g</td>
                  <td className="tabular pf-ledger-inr">₹{formatInr(row.total_inr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}
