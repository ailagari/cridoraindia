import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { buildJewellerDemandSeries } from './series'
import { PortfolioBarChart, PortfolioDonut, PortfolioSparkRow, PortfolioTrendChart } from './PortfolioCharts'

export function JewellerPortfolioPanel() {
  const { user } = useAuth()
  const seed = user?.id ?? 1

  const demandSeries = useMemo(() => buildJewellerDemandSeries(seed), [seed])
  const holdingsTrend = useMemo(() => demandSeries.map((v) => v * 42 + seed * 3), [demandSeries, seed])
  const barVals = [
    Math.round(seed * 2.8 + 48),
    Math.round(seed * 1.9 + 32),
    Math.round(seed * 1.2 + 24),
    Math.round(seed * 0.8 + 12),
  ]
  const donutSegs = useMemo(
    () => [
      { pct: 0.38, color: '#fbbf24', label: '22K bridal' },
      { pct: 0.29, color: '#d4a85c', label: '24K mint' },
      { pct: 0.21, color: '#a78bfa', label: 'Custom' },
      { pct: 0.12, color: '#38bdf8', label: 'Consignment' },
    ],
    [],
  )

  const sparkA = holdingsTrend.slice(0, 6)
  const sparkB = demandSeries.slice(-6)

  return (
    <div className="dash-panel-max pf-scope">
      <p className="dash-panel-lead pf-lead-intro">
        Jeweller desk pulse for inventory and customer demand — illustrative until catalog and gram liability APIs feed this
        view. Cards emphasise BIS 916 listings, transparent sellback, and readiness for redemption queues.
      </p>

      <div className="pf-grid pf-grid--kpis pf-stagger">
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--gold">
          <span className="pf-kpi__eyebrow">Showroom value (INR)</span>
          <p className="pf-kpi__value">
            ₹{Math.round((2.42 * seed + 118) * 1e5).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <span className="pf-kpi__hint">Est. showcase + vault</span>
        </div>
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--mint">
          <span className="pf-kpi__eyebrow">Gold on hand</span>
          <p className="pf-kpi__value">{(seed * 0.15 + 4.82).toFixed(2)} kg</p>
          <span className="pf-kpi__hint">SKU-weighted blended</span>
        </div>
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--iris">
          <span className="pf-kpi__eyebrow">Open orders</span>
          <p className="pf-kpi__value">{Math.round(seed * 0.6 + 7)}</p>
          <span className="pf-kpi__hint">Awaiting workshop / hallmark</span>
        </div>
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--rose">
          <span className="pf-kpi__eyebrow">Sparkline health</span>
          <div className="pf-kpi__spark">
            <PortfolioSparkRow points={sparkA} stroke="#f472b6" />
          </div>
          <span className="pf-kpi__hint">Illustrative demand lift</span>
        </div>
      </div>

      <div className="pf-grid pf-grid--charts pf-stagger">
        <article className="pf-card pf-card--lift">
          <header className="pf-card__head">
            <h3 className="pf-card__title">Inventory curve</h3>
            <p className="pf-card__meta">Synthetic curve — replace with live grams</p>
          </header>
          <div className="pf-card__viz">
            <PortfolioTrendChart
              values={holdingsTrend}
              stroke="#d4a85c"
              fillId="jeweller-area-gold"
              ariaLabel="Area chart of estimated inventory value trend"
            />
          </div>
        </article>

        <article className="pf-card pf-card--lift">
          <header className="pf-card__head">
            <h3 className="pf-card__title">Footfall / orders</h3>
            <p className="pf-card__meta">Daily-style bucket counts</p>
          </header>
          <div className="pf-card__viz">
            <PortfolioBarChart
              values={barVals}
              labels={['M', 'T', 'W', 'T']}
              colors={['#f472b6', '#a78bfa', '#34d399', '#38bdf8']}
              ariaLabel="Bar chart of weekly footfall or order counts"
            />
          </div>
        </article>

        <article className="pf-card pf-card--lift pf-card--wide">
          <header className="pf-card__head">
            <h3 className="pf-card__title">Metal mix</h3>
            <p className="pf-card__meta">Category share of active SKUs</p>
          </header>
          <div className="pf-donut-wrap">
            <PortfolioDonut segments={donutSegs} ariaLabel="Donut chart of metal or category mix" />
            <ul className="pf-donut-legend">
              {donutSegs.map((s) => (
                <li key={s.label} className="pf-donut-legend__row">
                  <span className="pf-swatch" style={{ background: s.color }} />
                  <span>{s.label}</span>
                  <strong>{Math.round(s.pct * 100)}%</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="pf-secondary-spark">
            <span className="pf-secondary-spark__label">Trailing signal</span>
            <PortfolioSparkRow points={sparkB} stroke="#67e8f9" />
          </div>
        </article>
      </div>
    </div>
  )
}
