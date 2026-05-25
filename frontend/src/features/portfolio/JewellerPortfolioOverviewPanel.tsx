import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { authFetch } from '@/lib/api'
import { fetchJewellerPortfolioSnapshot, type JewellerPortfolioSnapshot } from '@/lib/jewellerPortfolioSnapshot'
import { LIVE_BALANCE_POLL_MS, LIVE_PROFILE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { PortfolioBarChart, PortfolioDonut, PortfolioSparkRow } from './PortfolioCharts'
import { JewellerPortfolioPanel } from './JewellerPortfolioPanel'
import { TablePagination } from '@/components/ui'
import { useTablePagination } from '@/hooks/useTablePagination'

const DONUT_COLORS = ['#c9a840', '#3b9eff', '#67e8f9', '#a78bfa']

type TabId = 'overview' | 'queues'

type MeJson = { business_name?: string; gstin?: string; city?: string }

type Props = { onNavigate: (sectionKey: string) => void }

function fmtInr(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtG(n: number): string {
  return `${n.toFixed(4)} g`
}

function fmtCreditWhen(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso.slice(0, 10)
  return new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function parseCG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
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

  const kybTone = user?.kyc_status === 'verified' ? 'ok' : user?.kyc_status === 'rejected' ? 'bad' : 'wait'

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

  const recentCreditRows = snap?.recentCredits ?? []
  const creditsPg = useTablePagination(recentCreditRows.length, 10)
  const creditPageRows = creditsPg.active
    ? recentCreditRows.slice(creditsPg.sliceStart, creditsPg.sliceEnd)
    : recentCreditRows

  const kybBadgeClass =
    kybTone === 'ok' ? 'bdg bdg-ok' : kybTone === 'bad' ? 'bdg bdg-err' : 'bdg bdg-grey'

  return (
    <div className="dash-panel-max">
      <div className="ph">
        <h1>{me?.business_name ?? 'Your showroom'}</h1>
        <p>
          {me?.city ? `${me.city} · ` : ''}
          GSTIN {me?.gstin ?? '—'}
          {' · '}Counter custody, pipelines, and open queues at a glance.
        </p>
      </div>

      <div className="row row-b wrap mb20" style={{ alignItems: 'center', gap: 12 }}>
        <span className={kybBadgeClass} style={{ textTransform: 'capitalize', padding: '4px 10px' }}>
          KYB {user?.kyc_status ?? 'pending'}
        </span>
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('txn_purchases')}>
            Verify purchases ({snap?.pendingPurchases ?? 0})
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('txn_deposits')}>
            Deposits ({snap?.pendingDeposits ?? 0})
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('mkt_products')}>
            Catalogue
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('txn_ops')}>
            Ops inbox
          </button>
        </div>
      </div>

      <nav className="tabs" aria-label="Portfolio views">
        <button type="button" className={`tab-btn${tab === 'overview' ? ' on' : ''}`} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button type="button" className={`tab-btn${tab === 'queues' ? ' on' : ''}`} onClick={() => setTab('queues')}>
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
          <div className="hero mb20">
            <div className="row row-b wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <div className="hero-eyebrow">Total vaulted at counter</div>
                <div className="hero-grams">
                  {snap.custodyGrams.toFixed(3)}
                  <span className="unit">g</span>
                </div>
                <div className="hero-inr" style={{ marginTop: 6 }}>
                  ≈ ₹{fmtInr(snap.custodyValueInr)} marked across customer vault rows
                </div>
              </div>
              <div className="row wrap" style={{ alignSelf: 'flex-start', gap: 8 }}>
                <span className="bdg bdg-info" style={{ padding: '4px 10px' }}>
                  {snap.pendingTotal} open action{snap.pendingTotal === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            <svg
              className="spark"
              viewBox="0 0 500 56"
              preserveAspectRatio="none"
              style={{ width: '100%', height: 48, marginTop: 18, marginBottom: 2 }}
              aria-hidden
            >
              <defs>
                <linearGradient id="jw-hero-sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c9a840" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#c9a840" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,52 C35,46 58,42 90,38 S148,34 185,26 S238,22 278,14 S336,18 382,11 S438,14 500,8 L500,56 L0,56 Z"
                fill="url(#jw-hero-sg)"
              />
              <path
                d="M0,52 C35,46 58,42 90,38 S148,34 185,26 S238,22 278,14 S336,18 382,11 S438,14 500,8"
                fill="none"
                stroke="#c9a840"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <div className="hero-grid">
              <div className="hero-stat">
                <div className="hs-lbl">Custody value</div>
                <div className="hs-val tn c-gold">₹{fmtInr(snap.custodyValueInr)}</div>
              </div>
              <div className="hero-stat">
                <div className="hs-lbl">Custodial liability</div>
                <div className="hs-val tn">{fmtG(snap.liabilityGrams)}</div>
              </div>
              <div className="hero-stat">
                <div className="hs-lbl">Wallet balance</div>
                <div className="hs-val tn c-ok">{fmtG(snap.vaultGrams)}</div>
              </div>
              <div className="hero-stat">
                <div className="hs-lbl">Active customers</div>
                <div className="hs-val tn">{snap.customerCount}</div>
              </div>
            </div>
          </div>

          <div className="stat-row mb20">
            <div className="stat a">
              <div className="stat-lbl">Fractional grams</div>
              <div className="stat-val c-gold tn">{fmtG(snap.fractionalGrams)}</div>
              <div className="stat-sub">Vault fractional class</div>
            </div>
            <div className="stat b">
              <div className="stat-lbl">Deposit grams</div>
              <div className="stat-val c-ok tn">{fmtG(snap.depositGrams)}</div>
              <div className="stat-sub">Digitised holdings</div>
            </div>
            <div className="stat c">
              <div className="stat-lbl">Schemes</div>
              <div className="stat-val tn" style={{ color: 'var(--info)' }}>
                {fmtG(snap.schemeGrams)}
              </div>
              <div className="stat-sub">Golden scheme grams</div>
            </div>
            <div className="stat d">
              <div className="stat-lbl">Recorded revenue</div>
              <div className="stat-val c-gold tn">₹{fmtInr(snap.ledgerRevenueInr)}</div>
              <div className="stat-sub">Ledger total</div>
            </div>
          </div>

          <div className="stat-row mb20">
            <div className="stat a">
              <div className="stat-lbl">Loans outstanding</div>
              <div className="stat-val tn">₹{fmtInr(snap.loanOutstandingInr)}</div>
              <div className="stat-sub">
                {snap.activeLoanCount} active · {snap.pendingLoanCount} pending
              </div>
            </div>
            <div className="stat b">
              <div className="stat-lbl">Investment pipeline</div>
              <div className="stat-val tn">₹{fmtInr(snap.investmentSalesInr)}</div>
              <div className="stat-sub">Open purchase desk</div>
            </div>
            <div className="stat c">
              <div className="stat-lbl">Ornament sales</div>
              <div className="stat-val tn">₹{fmtInr(snap.ornamentRevenueInr)}</div>
              <div className="stat-sub">Vault shop</div>
            </div>
            <div className="stat d">
              <div className="stat-lbl">Combined revenue</div>
              <div className="stat-val c-gold tn">₹{fmtInr(snap.totalSalesInr)}</div>
              <div className="stat-sub">Pipeline + ornament</div>
            </div>
          </div>

          <div className="g2 mb20">
            <div className="card card-p">
              <div className="sec-title mb12">Gold in custody · by product</div>
              {gramsBar.values.length > 0 ? (
                <div style={{ paddingTop: 4 }}>
                  <PortfolioBarChart
                    values={gramsBar.values}
                    labels={gramsBar.labels}
                    colors={gramsBar.labels.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]!)}
                    ariaLabel="Grams in custody by product type"
                  />
                </div>
              ) : (
                <p className="t-fa fs11" style={{ margin: 0 }}>
                  No vaulted balances yet.
                </p>
              )}
            </div>

            <div className="card card-p">
              <div className="sec-title mb12">Open queues</div>
              {pendingDonut.length > 0 ? (
                <div className="row" style={{ alignItems: 'center', gap: 18 }}>
                  <div className="dash-donut-slot" style={{ flexShrink: 0 }}>
                    <PortfolioDonut segments={pendingDonut} ariaLabel="Pending work breakdown" />
                  </div>
                  <div className="stack" style={{ gap: 8, fontSize: '0.76rem', flex: 1 }}>
                    {pendingDonut.map((s) => (
                      <div key={s.label} className="row" style={{ alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 3,
                            background: s.color,
                            flexShrink: 0,
                          }}
                          aria-hidden
                        />
                        <span className="t-mu">
                          {s.label}
                          <br />
                          <strong className="tn" style={{ color: s.color }}>
                            {Math.round(s.pct * 100)}%
                          </strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="t-fa fs11" style={{ margin: 0 }}>
                  All queues clear.
                </p>
              )}
            </div>
          </div>

          <div className="card mb20">
            <div className="row-b" style={{ padding: '16px 20px 8px', alignItems: 'flex-start' }}>
              <div>
                <div className="sec-title">Liability credits</div>
                <div className="sec-sub t-fa">Recent grams credited to custody</div>
              </div>
            </div>
            {creditTrend.length > 0 ? (
              <div style={{ padding: '0 20px 12px' }}>
                <PortfolioSparkRow points={creditTrend} stroke="var(--gold-hi)" />
              </div>
            ) : null}
            <div className="tbl-wrap">
              {snap.recentCredits.length === 0 ? (
                <div className="empty" style={{ border: 'none', margin: 16 }}>
                  <div className="empty-ico" aria-hidden>
                    ⚖️
                  </div>
                  <h3>No recent credits</h3>
                  <p>Fractional confirmations will appear here.</p>
                </div>
              ) : (
                <>
                  <table className="tbl tbl-sm">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Customer</th>
                        <th>Reference</th>
                        <th className="tn">Grams</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditPageRows.map((row, idx) => (
                        <tr key={`${row.purchase_reference ?? ''}-${idx}-${row.created_at}`}>
                          <td className="tx">{fmtCreditWhen(row.created_at)}</td>
                          <td>{row.customer_label ?? row.customer_member_id ?? '—'}</td>
                          <td className="tn">{row.purchase_reference ?? '—'}</td>
                          <td className="tn c-gold">+{parseCG(row.grams).toFixed(4)} g</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {creditsPg.active ? (
                    <TablePagination
                      page={creditsPg.page}
                      totalPages={creditsPg.totalPages}
                      totalItems={recentCreditRows.length}
                      pageSize={creditsPg.pageSize}
                      onPrev={() => creditsPg.setPage((p) => Math.max(0, p - 1))}
                      onNext={() => creditsPg.setPage((p) => Math.min(creditsPg.totalPages - 1, p + 1))}
                      className="tbl-inline-pagination"
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </>
      ) : null}

      {tab === 'overview' && !snap && !loadErr ? (
        <div className="empty mt16">
          <div className="empty-ico" aria-hidden>
            ⏳
          </div>
          <h3>Loading desk snapshot…</h3>
          <p>If this persists, refresh after checking connectivity.</p>
        </div>
      ) : null}

      {tab === 'queues' ? (
        <div className="mt12">
          <JewellerPortfolioPanel embedded />
        </div>
      ) : null}
    </div>
  )
}
