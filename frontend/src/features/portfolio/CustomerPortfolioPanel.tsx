import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  buildCustomerHoldingsInrTrend,
  buildCustomerMockLedger,
  buildCustomerWeeklyGramBars,
  type MockLedgerRow,
} from './series'
import { PortfolioBarChart, PortfolioDonut, PortfolioSparkRow, PortfolioTrendChart } from './PortfolioCharts'

function ledgerPillClass(kind: MockLedgerRow['kind']): string {
  if (kind === 'buy') return 'pf-ledger-pill pf-ledger-pill--buy'
  if (kind === 'sell') return 'pf-ledger-pill pf-ledger-pill--sell'
  if (kind === 'fee') return 'pf-ledger-pill pf-ledger-pill--fee'
  if (kind === 'credit') return 'pf-ledger-pill pf-ledger-pill--credit'
  return 'pf-ledger-pill pf-ledger-pill--xfer'
}

function inrToneClass(txt: string): string {
  if (txt.startsWith('+')) return 'pf-ledger-inr pf-ledger-inr--in'
  if (txt.startsWith('-')) return 'pf-ledger-inr pf-ledger-inr--out'
  return 'pf-ledger-inr pf-ledger-inr--mute'
}

function parseBalanceG(balanceG: string): number {
  const m = balanceG.match(/([\d.]+)/)
  if (!m) return 0
  const n = Number.parseFloat(m[1] ?? '')
  return Number.isFinite(n) ? n : 0
}

const HOLDING_SECTION_LABEL: Record<MockLedgerRow['holdingType'], string> = {
  fractional: 'Fractional gold',
  deposit: 'Gold deposit',
  goldnest: 'GoldNest',
}

export function CustomerPortfolioPanel() {
  const { user } = useAuth()
  const seed = user?.id ?? 1
  const inrTrend = useMemo(() => buildCustomerHoldingsInrTrend(seed), [seed])
  const gramBars = useMemo(() => buildCustomerWeeklyGramBars(seed), [seed])
  const ledgerRows = useMemo(() => buildCustomerMockLedger(seed), [seed])

  const portfolioInr = inrTrend[inrTrend.length - 1] ?? 0
  const latestBalanceG = ledgerRows[0]?.balanceG ?? '—'
  const totalGrams = parseBalanceG(latestBalanceG)
  const redeemableGrams = totalGrams > 0 ? totalGrams * (0.86 + (seed % 7) * 0.015) : 0
  const redeemableLabel = totalGrams > 0 ? `${redeemableGrams.toFixed(3)} g` : '—'

  const changePct =
    inrTrend.length > 1 ? ((inrTrend[inrTrend.length - 1]! - inrTrend[0]!) / Math.max(inrTrend[0]!, 1)) * 100 : 0
  const pnlTone = changePct >= 0 ? 'pf-kpi--mint' : 'pf-kpi--rose'
  const sparkPts = inrTrend.slice(-7).map((v) => v / 1200)

  const donutSegs = useMemo(() => {
    const a = 0.4 + ((seed % 5) + 3) * 0.018
    const b = 0.32 + ((seed % 4) + 1) * 0.02
    const c = Math.max(0.14, 1 - a - b)
    const sum = a + b + c
    return [
      { pct: a / sum, color: '#fbbf24', label: 'Fractional gold' },
      { pct: b / sum, color: '#d4a85c', label: 'Gold deposit' },
      { pct: c / sum, color: '#67e8f9', label: 'GoldNest' },
    ]
  }, [seed])

  const ledgerByHolding = useMemo(() => {
    const buckets: Record<MockLedgerRow['holdingType'], MockLedgerRow[]> = {
      fractional: [],
      deposit: [],
      goldnest: [],
    }
    for (const row of ledgerRows) {
      buckets[row.holdingType].push(row)
    }
    return (['fractional', 'deposit', 'goldnest'] as const).map((k) => ({
      key: k,
      label: HOLDING_SECTION_LABEL[k],
      rows: buckets[k],
    }))
  }, [ledgerRows])

  return (
    <div className="dash-panel-max pf-scope">
      <p className="dash-panel-lead pf-lead-intro">
        Portfolio overview — illustrative charts until live ledger feeds replace demo curves.
      </p>

      <div className="pf-grid pf-grid--kpis pf-stagger">
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--gold">
          <span className="pf-kpi__eyebrow">Total gold</span>
          <p className="pf-kpi__value">{latestBalanceG}</p>
          <span className="pf-kpi__hint">All holding types combined</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--ocean">
          <span className="pf-kpi__eyebrow">Current value</span>
          <p className="pf-kpi__value">
            ₹{portfolioInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <span className="pf-kpi__hint">Live mark-to-market (sample curve)</span>
        </div>
        <div className={`pf-kpi pf-kpi--pulse ${pnlTone}`}>
          <span className="pf-kpi__eyebrow">Profit / loss</span>
          <p className="pf-kpi__value">
            {changePct >= 0 ? '+' : ''}
            {changePct.toFixed(1)}%
          </p>
          <span className="pf-kpi__hint">Across chart window · not advice</span>
        </div>
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--mint">
          <span className="pf-kpi__eyebrow">Redeemable gold</span>
          <p className="pf-kpi__value">{redeemableLabel}</p>
          <span className="pf-kpi__hint">Usable grams after lock-in &amp; policy (sample)</span>
        </div>
      </div>

      <div className="pf-grid pf-grid--charts pf-stagger">
        <article className="pf-card pf-card--lift">
          <header className="pf-card__head">
            <h3 className="pf-card__title">INR value history</h3>
            <p className="pf-card__meta">Portfolio curve — swaps to live `/api/` feed later</p>
          </header>
          <div className="pf-card__viz">
            <PortfolioTrendChart
              values={inrTrend}
              stroke="#fcd34d"
              fillId="customer-area-portfolio"
              ariaLabel="Area chart of portfolio INR value over time"
            />
          </div>
        </article>

        <article className="pf-card pf-card--lift">
          <header className="pf-card__head">
            <h3 className="pf-card__title">Weekly gram adds</h3>
            <p className="pf-card__meta">Estimated net grams credited (illus.)</p>
          </header>
          <div className="pf-card__viz">
            <PortfolioBarChart
              values={gramBars}
              labels={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
              colors={['#fcd34d', '#fbbf24', '#f472b6', '#38bdf8', '#34d399', '#a78bfa', '#d4a85c']}
              ariaLabel="Bar chart of weekly gram equivalent additions"
            />
          </div>
        </article>

        <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger">
          <header className="pf-card__head">
            <h3 className="pf-card__title">Holding mix</h3>
            <p className="pf-card__meta">Fractional, deposit, scheme mix (sample)</p>
          </header>
          <div className="pf-donut-row">
            <div className="pf-donut-wrap pf-donut-wrap--compact">
              <PortfolioDonut segments={donutSegs} ariaLabel="Allocation by holding type" />
              <ul className="pf-donut-legend pf-donut-legend--tight">
                {donutSegs.map((s) => (
                  <li key={s.label} className="pf-donut-legend__row">
                    <span className="pf-swatch" style={{ background: s.color }} />
                    <span>{s.label}</span>
                    <strong>{Math.round(s.pct * 100)}%</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div style={{ marginTop: '1rem' }} className="pf-kpi__spark">
            <PortfolioSparkRow points={sparkPts.length ? sparkPts : [1, 2, 3]} stroke="#fcd34d" />
            <p className="pf-card__meta" style={{ margin: '0.5rem 0 0' }}>
              Short-window INR pulse
            </p>
          </div>
        </article>
      </div>

      <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger-table-wrap pf-stagger">
        <header className="pf-card__head pf-ledger-head">
          <div>
            <h3 className="pf-card__title">Ledger by holding type</h3>
            <p className="pf-card__meta">
              Sample ledger rows — production ties to vault APIs per jeweller.
            </p>
          </div>
        </header>
        {ledgerByHolding.map((section) => (
          <div key={section.key} style={{ marginBottom: '1.5rem' }}>
            <h4
              style={{
                margin: '0 0 0.65rem',
                fontSize: '0.82rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--gold-light)',
              }}
            >
              {section.label}
            </h4>
            <div className="pf-ledger-scroll">
              <table className="pf-ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Detail</th>
                    <th className="tabular">Grams</th>
                    <th className="tabular">INR</th>
                    <th className="tabular">Gold bal.</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.id} className="pf-ledger-row">
                      <td className="pf-ledger-date">{row.when}</td>
                      <td>
                        <span className={ledgerPillClass(row.kind)}>{row.kind}</span>
                      </td>
                      <td>{row.detail}</td>
                      <td className="tabular pf-ledger-grams">{row.grams}</td>
                      <td className={`tabular ${inrToneClass(row.inr)}`}>{row.inr}</td>
                      <td className="tabular pf-ledger-bal">{row.balanceG}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </article>
    </div>
  )
}
