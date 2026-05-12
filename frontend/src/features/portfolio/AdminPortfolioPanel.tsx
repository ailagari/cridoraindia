import { useMemo } from 'react'
import { buildPlatformUserTrend, type AdminPortfolioStats } from './series'
import { PortfolioBarChart, PortfolioDonut, PortfolioTrendChart } from './PortfolioCharts'

export function AdminPortfolioPanel({ stats }: { stats: AdminPortfolioStats }) {
  const trend = useMemo(() => buildPlatformUserTrend(stats.total_users), [stats.total_users])
  const barValues = [
    stats.total_customers || 1,
    stats.total_jewellers || (stats.total_users > 0 ? 1 : 0),
    stats.kyc_review_queue_count + 4,
    stats.kyb_review_queue_count + 2,
  ]
  const donutSegs = useMemo(() => {
    const t = Math.max(stats.total_users, 1)
    const queue = stats.kyc_review_queue_count + stats.kyb_review_queue_count
    const pendingId = stats.pending_kyc_identity + stats.pending_kyb_identity
    const wActive = Math.max(0.12, (t - queue - pendingId) / t)
    const wQueue = Math.max(0.08, queue / t)
    const wId = Math.max(0.06, pendingId / t)
    const wOther = Math.max(0.05, 1 - wActive - wQueue - wId)
    const sum = wActive + wQueue + wId + wOther
    const normalize = (w: number) => w / sum
    return [
      { pct: normalize(wActive), color: '#34d399', label: 'Cleared cohort' },
      { pct: normalize(wQueue), color: '#fbbf24', label: 'Docs in review' },
      { pct: normalize(wId), color: '#38bdf8', label: 'Identity backlog' },
      { pct: normalize(wOther), color: '#a78bfa', label: 'Residual' },
    ]
  }, [stats])

  return (
    <div className="dash-panel-max pf-scope">
      <p className="dash-panel-lead pf-lead-intro">
        Network cohort view — KYC/KYB queues, verified users, and jewellers on the live gold savings and
        redemption platform. Series are illustrative until ledger endpoints connect.
      </p>

      <div className="pf-grid pf-grid--kpis pf-stagger">
        <div className="pf-kpi pf-kpi--pulse pf-kpi--mint">
          <span className="pf-kpi__eyebrow">Total users</span>
          <p className="pf-kpi__value">{stats.total_users}</p>
          <span className="pf-kpi__hint">Registrations onboarded</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--gold">
          <span className="pf-kpi__eyebrow">Gold accounts</span>
          <p className="pf-kpi__value">{stats.total_customers}</p>
          <span className="pf-kpi__hint">Customer wallets (target)</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--iris">
          <span className="pf-kpi__eyebrow">Partner jewellers</span>
          <p className="pf-kpi__value">{stats.total_jewellers}</p>
          <span className="pf-kpi__hint">KYB-certified supply</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--ocean">
          <span className="pf-kpi__eyebrow">Compliance load</span>
          <p className="pf-kpi__value">{stats.kyc_review_queue_count + stats.kyb_review_queue_count}</p>
          <span className="pf-kpi__hint">Queues today</span>
        </div>
      </div>

      <div className="pf-grid pf-grid--charts pf-stagger">
        <article className="pf-card pf-card--lift">
          <header className="pf-card__head">
            <h3 className="pf-card__title">User momentum</h3>
            <p className="pf-card__meta">9-point trend · scaled from live totals</p>
          </header>
          <div className="pf-card__viz">
            <PortfolioTrendChart
              values={trend}
              stroke="#67e8f9"
              fillId="admin-area-cyan"
              ariaLabel="Line chart showing platform user count trend across nine samples"
            />
          </div>
        </article>

        <article className="pf-card pf-card--lift">
          <header className="pf-card__head">
            <h3 className="pf-card__title">Ecosystem bars</h3>
            <p className="pf-card__meta">Customers, jewellers, KYC queue, KYB queue</p>
          </header>
          <div className="pf-card__viz">
            <PortfolioBarChart
              values={barValues}
              labels={['Cust', 'Jew', 'KYC', 'KYB']}
              colors={['#34d399', '#d4a85c', '#fbbf24', '#a78bfa']}
              ariaLabel="Bar chart comparing customer count, jeweller count, and review queue sizes"
            />
          </div>
        </article>

        <article className="pf-card pf-card--lift pf-card--wide">
          <header className="pf-card__head">
            <h3 className="pf-card__title">Verification funnel</h3>
            <p className="pf-card__meta">Share of cohort by status (estimated)</p>
          </header>
          <div className="pf-donut-wrap">
            <PortfolioDonut segments={donutSegs} ariaLabel="Donut chart of verification status shares" />
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
        </article>
      </div>
    </div>
  )
}
