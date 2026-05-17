import { useMemo } from 'react'
import { buildPlatformUserTrend, type AdminPortfolioStats } from './series'
import { PortfolioBarChart, PortfolioDonut, PortfolioTrendChart } from './PortfolioCharts'

function parseStatGrams(s: string | undefined): number {
  if (!s?.trim()) return 0
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function AdminPortfolioPanel({ stats }: { stats: AdminPortfolioStats }) {
  const trend = useMemo(() => buildPlatformUserTrend(stats.total_users), [stats.total_users])
  const barValues = [
    stats.total_customers || 1,
    stats.total_jewellers || (stats.total_users > 0 ? 1 : 0),
    stats.kyc_review_queue_count,
    stats.kyb_review_queue_count,
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

  const ledgerDonutSegs = useMemo(() => {
    const cust = parseStatGrams(stats.customer_fractional_grams_total)
    const liab = parseStatGrams(stats.jeweller_custodial_liability_grams_total)
    const sum = cust + liab
    if (sum <= 0) {
      return [{ pct: 1, color: '#475569', label: 'No fractional balances recorded' }]
    }
    return [
      { pct: cust / sum, color: '#fbbf24', label: 'Customer vault fractional' },
      { pct: liab / sum, color: '#f472b6', label: 'Jeweller custodial liability' },
    ]
  }, [stats.customer_fractional_grams_total, stats.jeweller_custodial_liability_grams_total])

  const fracPending = stats.fractional_orders_pending_counter ?? 0
  const fracDone = stats.fractional_orders_completed ?? 0
  const depPending = stats.gold_deposit_pending_otp ?? 0
  const depDone = stats.gold_deposit_completed ?? 0

  return (
    <div className="dash-panel-max pf-scope">
      <p className="dash-panel-lead pf-lead-intro">
        Network cohort view — live fractional totals sit alongside KYC/KYB queues and user momentum charts (user trend is
        scaled from headcount; bars use live queue counts).
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

      <div className="pf-grid pf-grid--kpis pf-stagger" style={{ marginTop: '0.35rem' }}>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--gold">
          <span className="pf-kpi__eyebrow">Customer vault grams</span>
          <p className="pf-kpi__value">{parseStatGrams(stats.customer_fractional_grams_total).toFixed(6)}</p>
          <span className="pf-kpi__hint">Fractional gold across customer vaults</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--rose">
          <span className="pf-kpi__eyebrow">Jeweller liability grams</span>
          <p className="pf-kpi__value">{parseStatGrams(stats.jeweller_custodial_liability_grams_total).toFixed(6)}</p>
          <span className="pf-kpi__hint">Custodial obligations on jeweller books</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--iris">
          <span className="pf-kpi__eyebrow">Counter orders pending</span>
          <p className="pf-kpi__value">{fracPending}</p>
          <span className="pf-kpi__hint">Awaiting jeweller OTP</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--mint">
          <span className="pf-kpi__eyebrow">Fractional completed</span>
          <p className="pf-kpi__value">{fracDone}</p>
          <span className="pf-kpi__hint">Fully verified purchases</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--ocean">
          <span className="pf-kpi__eyebrow">Deposit OTP pending</span>
          <p className="pf-kpi__value">{depPending}</p>
          <span className="pf-kpi__hint">Gold deposit intakes</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--rose">
          <span className="pf-kpi__eyebrow">Deposits completed</span>
          <p className="pf-kpi__value">{depDone}</p>
          <span className="pf-kpi__hint">Credited vault grams</span>
        </div>
      </div>

      {stats.ledger_note ? <p className="dash-footnote">{stats.ledger_note}</p> : null}

      <div className="pf-grid pf-grid--charts pf-stagger">
        <article className="pf-card pf-card--lift pf-card--wide">
          <header className="pf-card__head">
            <h3 className="pf-card__title">Fractional grams alignment</h3>
            <p className="pf-card__meta">Vault holdings vs custodial liability (platform totals)</p>
          </header>
          <div className="pf-donut-wrap">
            <PortfolioDonut segments={ledgerDonutSegs} ariaLabel="Donut of customer vault grams versus jeweller liability" />
            <ul className="pf-donut-legend">
              {ledgerDonutSegs.map((s) => (
                <li key={s.label} className="pf-donut-legend__row">
                  <span className="pf-swatch" style={{ background: s.color }} />
                  <span>{s.label}</span>
                  <strong>{Math.round(s.pct * 100)}%</strong>
                </li>
              ))}
            </ul>
          </div>
        </article>

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
