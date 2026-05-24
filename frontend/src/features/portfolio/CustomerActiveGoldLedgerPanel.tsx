import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui'
import {
  fetchActiveGoldLedger,
  type ActiveGoldLotDTO,
  type ActiveGoldLedgerSummaryDTO,
} from '@/lib/personalHoldingsApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function fmtInr(s: string | number): string {
  const n = typeof s === 'number' ? s : Number.parseFloat(s)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function fmtWhen(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso.slice(0, 10)
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function sourceTone(source: string): 'success' | 'danger' | 'warning' | 'gold' {
  if (source === 'fractional') return 'gold'
  if (source === 'deposit') return 'success'
  if (source === 'transfer_in') return 'warning'
  return 'gold'
}

function pnlTone(pnl: string): string {
  if (!pnl) return 'var(--text-muted)'
  const n = Number.parseFloat(pnl)
  if (!Number.isFinite(n) || n === 0) return 'var(--text-muted)'
  return n > 0 ? 'var(--success)' : 'var(--danger)'
}

function SummaryCard({ summary }: { summary: ActiveGoldLedgerSummaryDTO }) {
  const pnl = summary.total_pnl_inr
  const pnlPct = summary.total_pnl_percent
  return (
    <div className="pf-grid pf-grid--kpis pf-stagger pf-active-ledger-summary">
      <div className="pf-kpi pf-kpi--gold">
        <span className="pf-kpi__eyebrow">Vault holdings</span>
        <p className="pf-kpi__value tabular">{summary.lot_count}</p>
        <span className="pf-kpi__hint">
          {parseG(summary.vault_balance_grams ?? summary.total_grams).toFixed(4)} g · matches vault total
        </span>
      </div>
      <div className="pf-kpi pf-kpi--ocean">
        <span className="pf-kpi__eyebrow">Total cost</span>
        <p className="pf-kpi__value tabular">{summary.total_cost_inr ? `₹${fmtInr(summary.total_cost_inr)}` : '—'}</p>
        <span className="pf-kpi__hint">Where recorded (pre-GST metal + deposits)</span>
      </div>
      <div className="pf-kpi pf-kpi--gold">
        <span className="pf-kpi__eyebrow">Live value</span>
        <p className="pf-kpi__value tabular">₹{fmtInr(summary.total_live_value_inr)}</p>
        <span className="pf-kpi__hint">Jeweller board marks today</span>
      </div>
      <div className="pf-kpi pf-kpi--ocean">
        <span className="pf-kpi__eyebrow">Unrealized P/L</span>
        <p className="pf-kpi__value tabular" style={{ color: pnlTone(pnl) }}>
          {pnl ? `₹${fmtInr(pnl)}` : '—'}
          {pnlPct ? ` (${pnlPct}%)` : ''}
        </p>
        <span className="pf-kpi__hint">On costed lots only</span>
      </div>
    </div>
  )
}

export function CustomerActiveGoldLedgerPanel() {
  const [summary, setSummary] = useState<ActiveGoldLedgerSummaryDTO | null>(null)
  const [lots, setLots] = useState<ActiveGoldLotDTO[]>([])
  const [loadErr, setLoadErr] = useState('')

  const load = useCallback(async () => {
    setLoadErr('')
    const data = await fetchActiveGoldLedger()
    if (!data) {
      setLoadErr('Could not load active gold ledger.')
      setSummary(null)
      setLots([])
      return
    }
    setSummary(data.summary)
    setLots(data.lots)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, true)

  return (
    <section className="pf-active-ledger-section" aria-labelledby="pf-active-ledger-title">
      <header style={{ marginBottom: '0.85rem' }}>
        <h3 id="pf-active-ledger-title" style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>
          Active gold ledger
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Current vaulted holdings by jeweller and type — matches your vault balance. Cost and P/L use purchase or
          deposit records where available.
        </p>
      </header>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      {summary ? <SummaryCard summary={summary} /> : null}

      {lots.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
          No active gold lots yet. Fractional buys, deposits, and transfers will appear here.
        </p>
      ) : (
        <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger-table-wrap" style={{ marginTop: '1rem' }}>
          <div className="pf-ledger-scroll">
            <table className="pf-ledger-table pf-active-ledger-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Reference</th>
                  <th>Jeweller</th>
                  <th className="tabular">Grams</th>
                  <th className="tabular">Price ₹/g</th>
                  <th className="tabular">Cost ₹</th>
                  <th className="tabular">Live ₹</th>
                  <th className="tabular">P/L ₹</th>
                  <th className="tabular">P/L %</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((row) => (
                  <tr key={`${row.reference}-${row.occurred_at}`} className="pf-ledger-row">
                    <td className="pf-ledger-date">{fmtWhen(row.occurred_at)}</td>
                    <td>
                      <Badge tone={sourceTone(row.source_type)}>{row.source_label}</Badge>
                    </td>
                    <td className="tabular">{row.reference}</td>
                    <td>{row.jeweller_name || '—'}</td>
                    <td className="tabular pf-ledger-grams">{parseG(row.grams).toFixed(4)} g</td>
                    <td className="tabular pf-ledger-inr">
                      {row.price_inr_per_gram ? `₹${fmtInr(row.price_inr_per_gram)}` : '—'}
                    </td>
                    <td className="tabular pf-ledger-inr">
                      {row.cost_inr ? `₹${fmtInr(row.cost_inr)}` : '—'}
                    </td>
                    <td className="tabular pf-ledger-inr">₹{fmtInr(row.live_value_inr)}</td>
                    <td className="tabular pf-ledger-inr" style={{ color: pnlTone(row.pnl_inr), fontWeight: 600 }}>
                      {row.pnl_inr ? `₹${fmtInr(row.pnl_inr)}` : '—'}
                    </td>
                    <td className="tabular" style={{ color: pnlTone(row.pnl_inr) }}>
                      {row.pnl_percent ? `${row.pnl_percent}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pf-groww-footnote" style={{ margin: '0.75rem 0 0' }}>
            One row per jeweller holding type (fractional, deposit, scheme). Grams sum to your vault total — not every
            past purchase. Live values use each jeweller&apos;s board ₹/g. Transfers and scheme balances may not have
            recorded cost.
          </p>
        </article>
      )}
    </section>
  )
}
