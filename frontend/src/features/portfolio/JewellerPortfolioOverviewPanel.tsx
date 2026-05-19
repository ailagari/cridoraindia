import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { authFetch } from '@/lib/api'
import {
  fetchJewellerPortfolioSnapshot,
  type JewellerPortfolioSnapshot,
} from '@/lib/jewellerPortfolioSnapshot'
import { LIVE_BALANCE_POLL_MS, LIVE_PROFILE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { PortfolioBarChart, PortfolioDonut, PortfolioTrendChart } from './PortfolioCharts'
import { JewellerPortfolioPanel } from './JewellerPortfolioPanel'
import { DashboardActions } from '@/components/ui'

const DONUT_COLORS = ['#fbbf24', '#d4a85c', '#67e8f9', '#a78bfa']

type TabId = 'overview' | 'queues'

type MeJson = { business_name?: string; gstin?: string; city?: string }

type Props = { onNavigate: (sectionKey: string) => void }

function fmtInr(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtG(n: number): string {
  return `${n.toFixed(4)} g`
}

export function JewellerPortfolioOverviewPanel({ onNavigate }: Props) {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabId>('overview')
  const [snap, setSnap] = useState<JewellerPortfolioSnapshot | null>(null)
  const [me, setMe] = useState<MeJson | null>(null)
  const [loadErr, setLoadErr] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const data = await fetchJewellerPortfolioSnapshot()
    if (!data) {
      setLoadErr('Could not load portfolio summary.')
      setSnap(null)
      return
    }
    setSnap(data)
  }, [])

  const refreshMe = useCallback(async () => {
    const r = await authFetch('/api/v1/auth/me/')
    if (r.ok) setMe((await r.json()) as MeJson)
  }, [])

  useEffect(() => {
    void refresh()
    void refreshMe()
  }, [refresh, refreshMe])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)
  useLivePoll(refreshMe, LIVE_PROFILE_POLL_MS, true)

  const kybTone =
    user?.kyc_status === 'verified' ? 'ok' : user?.kyc_status === 'rejected' ? 'bad' : 'wait'

  const gramsBar = useMemo(() => {
    if (!snap) return { values: [] as number[], labels: [] as string[] }
    const rows = [
      { label: 'Fractional', value: snap.fractionalGrams },
      { label: 'Deposits', value: snap.depositGrams },
      { label: 'Schemes', value: snap.schemeGrams },
    ].filter((r) => r.value > 0.0001)
    return { values: rows.map((r) => r.value), labels: rows.map((r) => r.label) }
  }, [snap])

  const pendingDonut = useMemo(() => {
    if (!snap) return []
    const raw = [
      { label: 'Purchases', value: snap.pendingPurchases },
      { label: 'Deposits', value: snap.pendingDeposits },
      { label: 'Sellbacks', value: snap.pendingSellbacks },
      { label: 'Cross', value: snap.pendingCross },
    ].filter((r) => r.value > 0)
    const total = raw.reduce((s, r) => s + r.value, 0) || 1
    return raw.map((r, i) => ({
      label: r.label,
      pct: r.value / total,
      color: DONUT_COLORS[i % DONUT_COLORS.length]!,
    }))
  }, [snap])

  const creditTrend = useMemo(() => {
    if (!snap?.recentCredits.length) return []
    return [...snap.recentCredits]
      .slice(0, 12)
      .reverse()
      .map((c) => Number.parseFloat(c.grams) || 0)
  }, [snap])

  return (
    <div className="dash-panel-max pf-scope">
      <div className="pf-groww-shell pf-stagger">
        <header className="pf-jeweller-hero pf-stagger">
          <div>
            <p className="pf-groww-footnote" style={{ margin: '0 0 0.35rem' }}>
              {me?.city ? `${me.city} · ` : ''}
              GSTIN {me?.gstin ?? '—'}
            </p>
            <h2 className="pf-jeweller-hero__title">{me?.business_name ?? 'Your showroom'}</h2>
            <p className="pf-jeweller-hero__sub">Today’s actions first.</p>
          </div>
          <span className={`pf-jeweller-kyb pf-jeweller-kyb--${kybTone}`}>{user?.kyc_status ?? 'pending'}</span>
        </header>

        <DashboardActions
          actions={[
            { label: 'Verify purchases', description: `${snap?.pendingPurchases ?? 0} waiting`, tone: 'primary', onClick: () => onNavigate('txn_purchases') },
            { label: 'Check deposits', description: `${snap?.pendingDeposits ?? 0} open`, onClick: () => onNavigate('txn_deposits') },
            { label: 'Manage catalogue', description: 'Products and rates', onClick: () => onNavigate('mkt_products') },
          ]}
          aside={snap ? `${snap.pendingTotal} open` : undefined}
        />

        <nav className="pf-groww-tabs" aria-label="Portfolio views">
          <button
            type="button"
            className={`pf-groww-tab${tab === 'overview' ? ' pf-groww-tab--active' : ''}`}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`pf-groww-tab${tab === 'queues' ? ' pf-groww-tab--active' : ''}`}
            onClick={() => setTab('queues')}
          >
            Queues
            {snap && snap.pendingTotal > 0 ? (
              <span className="dash-nav-badge" style={{ marginLeft: 6 }}>
                {snap.pendingTotal > 99 ? '99+' : snap.pendingTotal}
              </span>
            ) : null}
          </button>
        </nav>

        {loadErr ? <p className="form-error">{loadErr}</p> : null}

        {tab === 'overview' && snap ? (
          <>
            <div className="pf-grid pf-grid--kpis pf-stagger">
              <div className="pf-kpi pf-kpi--shimmer pf-kpi--gold">
                <span className="pf-kpi__eyebrow">Custody value</span>
                <p className="pf-kpi__value tabular">₹{fmtInr(snap.custodyValueInr)}</p>
                <span className="pf-kpi__hint">{snap.customerCount} customers</span>
              </div>
              <div className="pf-kpi pf-kpi--pulse pf-kpi--ocean">
                <span className="pf-kpi__eyebrow">Total vaulted</span>
                <p className="pf-kpi__value tabular">{fmtG(snap.custodyGrams)}</p>
                <span className="pf-kpi__hint">Vaulted</span>
              </div>
              <div className="pf-kpi pf-kpi--shimmer pf-kpi--mint">
                <span className="pf-kpi__eyebrow">Shop revenue</span>
                <p className="pf-kpi__value tabular">₹{fmtInr(snap.ornamentRevenueInr)}</p>
                <span className="pf-kpi__hint">Shop</span>
              </div>
              <div className="pf-kpi pf-kpi--pulse pf-kpi--iris">
                <span className="pf-kpi__eyebrow">Counter pipeline</span>
                <p className="pf-kpi__value tabular">₹{fmtInr(snap.investmentSalesInr)}</p>
                <span className="pf-kpi__hint">Pipeline</span>
              </div>
              <div className="pf-kpi pf-kpi--shimmer pf-kpi--rose">
                <span className="pf-kpi__eyebrow">Deposits (gold)</span>
                <p className="pf-kpi__value tabular">{fmtG(snap.depositGrams)}</p>
                <span className="pf-kpi__hint">Deposits</span>
              </div>
              <div className="pf-kpi pf-kpi--pulse pf-kpi--gold">
                <span className="pf-kpi__eyebrow">Investments</span>
                <p className="pf-kpi__value tabular">{fmtG(snap.fractionalGrams)}</p>
                <span className="pf-kpi__hint">Fractional</span>
              </div>
              <div className="pf-kpi pf-kpi--shimmer pf-kpi--rose">
                <span className="pf-kpi__eyebrow">Custodial liability</span>
                <p className="pf-kpi__value tabular">{fmtG(snap.liabilityGrams)}</p>
                <span className="pf-kpi__hint">Liability</span>
              </div>
              <div className="pf-kpi pf-kpi--pulse pf-kpi--ocean">
                <span className="pf-kpi__eyebrow">Pending actions</span>
                <p className="pf-kpi__value tabular">{snap.pendingTotal}</p>
                <span className="pf-kpi__hint">Needs action</span>
              </div>
            </div>

            <details className="dash-disclosure">
              <summary>Analytics</summary>
              <div className="dash-disclosure__body pf-grid pf-grid--charts pf-stagger">
              <article className="pf-card pf-card--lift">
                <h3 className="pf-card__title">Gold in custody (grams)</h3>
                <p className="pf-card__meta">Split by product type across your customers.</p>
                {gramsBar.values.length > 0 ? (
                  <PortfolioBarChart
                    values={gramsBar.values}
                    labels={gramsBar.labels}
                    colors={gramsBar.labels.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]!)}
                    ariaLabel="Grams in custody by product type"
                  />
                ) : (
                  <p className="pf-groww-footnote">No vaulted balances yet.</p>
                )}
              </article>
              <article className="pf-card pf-card--lift">
                <h3 className="pf-card__title">Open queues</h3>
                <p className="pf-card__meta">Items needing counter action.</p>
                {pendingDonut.length > 0 ? (
                  <>
                    <PortfolioDonut segments={pendingDonut} ariaLabel="Open queue breakdown" />
                    <ul className="pf-donut-legend">
                      {pendingDonut.map((s) => (
                        <li key={s.label} className="pf-donut-legend__row">
                          <span className="pf-swatch" style={{ background: s.color }} />
                          <span>{s.label}</span>
                          <strong>{Math.round(s.pct * 100)}%</strong>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="pf-groww-footnote">All queues clear.</p>
                )}
              </article>
              <article className="pf-card pf-card--lift pf-card--wide">
                <h3 className="pf-card__title">Recent liability credits</h3>
                <p className="pf-card__meta">Grams posted when counter purchases complete.</p>
                {creditTrend.length > 1 ? (
                  <PortfolioTrendChart
                    values={creditTrend}
                    stroke="var(--gold-light)"
                    fillId="jeweller-credit-trend"
                    ariaLabel="Recent liability credit grams"
                  />
                ) : (
                  <p className="pf-groww-footnote">Credits will appear after verified purchases.</p>
                )}
              </article>
              </div>
            </details>
          </>
        ) : null}

        {tab === 'queues' ? (
          <div className="pf-stagger" style={{ marginTop: '0.5rem' }}>
            <JewellerPortfolioPanel embedded />
          </div>
        ) : null}
      </div>
    </div>
  )
}
