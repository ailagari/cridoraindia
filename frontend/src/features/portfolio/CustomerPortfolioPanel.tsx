import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchGoldWallet, vaultRowEstimatedInr, vaultRowTotalGrams, type VaultRowDTO } from '@/lib/goldTransferApi'
import { fetchPortfolioLedger, type PortfolioLedgerEntryDTO } from '@/lib/personalHoldingsApi'
import { CustomerPersonalHoldingsPanel } from '@/features/portfolio/CustomerPersonalHoldingsPanel'
import { fetchGoldTicker, fetchSpotPrices, type GoldTickerPayload, type SpotPricesPayload } from '@/lib/marketplaceApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import {
  PortfolioBarChart,
  PortfolioCostVsMarketBoard,
  PortfolioDonut,
  PortfolioLiveValueVsCostChart,
} from './PortfolioCharts'
import { PortfolioGrowwHero, PortfolioSpotPillsRow, PortfolioVaultHoldingsList } from './PortfolioGrowwViews'
import { CustomerVaultsPanel } from './CustomerVaultsPanel'
import { DashboardActions } from '@/components/ui'

const DONUT_COLORS = ['#fbbf24', '#d4a85c', '#67e8f9', '#a78bfa', '#34d399', '#f472b6', '#38bdf8']
const SESSION_VALUE_SAMPLES_CAP = 56

type PortfolioTabId = 'overview' | 'active' | 'personal' | 'charts' | 'transactions'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function fmtInrSum(vaults: VaultRowDTO[]): number {
  let t = 0
  for (const v of vaults) {
    t += vaultRowEstimatedInr(v)
  }
  return t
}

function fmtWhen(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso.slice(0, 10)
  return new Date(t).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

function fmtInrPlain(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatPortfolioLedgerTxnType(t: string): string {
  switch (t) {
    case 'fractional':
      return 'Fractional'
    case 'transfer_in':
      return 'Transfer in'
    case 'transfer_out':
      return 'Transfer out'
    case 'sellback':
      return 'Redemption'
    case 'redemption_purchase':
      return 'Vault shop'
    case 'golden_scheme':
      return 'Golden scheme'
    case 'deposit':
      return 'Deposit'
    case 'personal':
      return 'Personal'
    case 'cridorapay_purchase':
      return 'CridoraPay'
    case 'loan_collateral_lock':
      return 'Loan · locked'
    case 'loan_disbursement':
      return 'Loan · cash in'
    case 'loan_repayment':
      return 'Loan · repayment'
    case 'loan_collateral_release':
      return 'Loan · gold back'
    default:
      return t.replace(/_/g, ' ')
  }
}

function portfolioLedgerPillClass(t: string): string {
  const base = 'pf-ledger-pill'
  switch (t) {
    case 'transfer_out':
    case 'sellback':
    case 'redemption_purchase':
      return `${base} pf-ledger-pill--sell`
    case 'transfer_in':
      return `${base} pf-ledger-pill--credit`
    case 'golden_scheme':
      return `${base} pf-ledger-pill--fee`
    case 'deposit':
    case 'personal':
    case 'cridorapay_purchase':
      return `${base} pf-ledger-pill--xfer`
    case 'fractional':
    default:
      return `${base} pf-ledger-pill--buy`
  }
}

function parseInrNum(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function CustomerPortfolioPanel() {
  const [searchParams] = useSearchParams()
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof fetchGoldWallet>>>(null)
  const [spotPayload, setSpotPayload] = useState<SpotPricesPayload | null>(null)
  const [goldTickerFallback, setGoldTickerFallback] = useState<GoldTickerPayload | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [privacyMasked, setPrivacyMasked] = useState(false)
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTabId>('overview')
  const [ledgerFilter, setLedgerFilter] = useState('all')
  const [ledgerEntries, setLedgerEntries] = useState<PortfolioLedgerEntryDTO[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [sessionValueSamples, setSessionValueSamples] = useState<number[]>([])
  const basisInrRef = useRef<number | null>(null)
  const portfolioTabsRef = useRef<HTMLElement | null>(null)

  const refresh = useCallback(async () => {
    setLoadErr('')
    const [w, sp] = await Promise.all([fetchGoldWallet(), fetchSpotPrices()])
    if (!w) {
      setLoadErr('Could not load wallet.')
      setWallet(null)
      setSpotPayload(sp)
      if (!sp) {
        const t = await fetchGoldTicker()
        setGoldTickerFallback(t)
      } else {
        setGoldTickerFallback(null)
      }
      return
    }
    setWallet(w)
    setSpotPayload(sp)
    if (!sp) {
      const t = await fetchGoldTicker()
      setGoldTickerFallback(t)
    } else {
      setGoldTickerFallback(null)
    }
  }, [])

  useEffect(() => {
    const raw = (searchParams.get('portfolio_tab') || '').trim().toLowerCase()
    if (raw === 'documents') {
      setPortfolioTab('personal')
      return
    }
    const allowed = new Set(['overview', 'active', 'personal', 'transactions', 'charts'])
    if (raw && allowed.has(raw)) {
      setPortfolioTab(raw as PortfolioTabId)
    }
  }, [searchParams])

  useEffect(() => {
    const nav = portfolioTabsRef.current
    if (!nav) return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 721px)').matches) return
    const active = nav.querySelector('.pf-groww-tab--active')
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [portfolioTab])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  useEffect(() => {
    if (portfolioTab !== 'transactions') return
    let cancelled = false
    ;(async () => {
      setLedgerLoading(true)
      const r = await fetchPortfolioLedger(ledgerFilter)
      if (!cancelled) {
        setLedgerEntries(r?.entries ?? [])
        setLedgerLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [portfolioTab, ledgerFilter])

  const vaults = wallet?.vaults ?? []
  const totals = wallet?.portfolio_totals ?? null
  const ledger = wallet?.fractional_ledger ?? []
  const totalGramsStr = wallet?.balance_grams ?? '0'
  const totalGrams = parseG(totalGramsStr)
  const estInr = fmtInrSum(vaults)

  const activeVaultCount = useMemo(
    () => vaults.filter((v) => vaultRowTotalGrams(v) > 0).length,
    [vaults],
  )

  const heldGramsSum = useMemo(
    () => vaults.reduce((acc, v) => acc + Math.max(0, vaultRowTotalGrams(v)), 0),
    [vaults],
  )

  const donutSegs = useMemo(() => {
    if (vaults.length === 0) {
      return [{ pct: 1, color: '#475569', label: 'No vault holdings yet' }]
    }
    const grams = vaults.map((v) => Math.max(0, vaultRowTotalGrams(v)))
    const sum = grams.reduce((a, b) => a + b, 0) || 1
    return vaults.map((v, i) => ({
      pct: Math.max(0, vaultRowTotalGrams(v)) / sum,
      color: DONUT_COLORS[i % DONUT_COLORS.length]!,
      label: v.custodian_label || `Jeweller ${v.custodian_id}`,
    }))
  }, [vaults])

  const vaultBarVals = useMemo(() => vaults.map((v) => vaultRowTotalGrams(v)), [vaults])
  const vaultBarLabels = useMemo(
    () =>
      vaults.map((v) => {
        const raw = v.custodian_label || `#${v.custodian_id}`
        return raw.length > 10 ? `${raw.slice(0, 9)}…` : raw
      }),
    [vaults],
  )

  const unrealized = wallet?.portfolio_unrealized
  const pnlInr = unrealized ? parseInrNum(unrealized.unrealized_pnl_inr) : 0
  const allocatedCost = unrealized ? parseInrNum(unrealized.allocated_cost_inr) : 0
  const pnlPctStr = unrealized?.unrealized_pnl_percent?.trim() ?? ''
  const pnlPct = pnlPctStr !== '' ? Number.parseFloat(pnlPctStr) : NaN

  const marketValueInr = useMemo(() => {
    const raw = unrealized?.market_value_inr?.trim()
    if (raw) {
      const n = Number.parseFloat(raw)
      if (Number.isFinite(n)) return n
    }
    return estInr
  }, [unrealized?.market_value_inr, estInr])

  useEffect(() => {
    if (heldGramsSum <= 0) {
      setSessionValueSamples([])
      basisInrRef.current = allocatedCost
      return
    }
    const prevBasis = basisInrRef.current
    basisInrRef.current = allocatedCost
    if (prevBasis !== null && prevBasis !== allocatedCost) {
      setSessionValueSamples([marketValueInr])
      return
    }
    setSessionValueSamples((prev) =>
      [...prev, marketValueInr].slice(-SESSION_VALUE_SAMPLES_CAP),
    )
  }, [allocatedCost, heldGramsSum, marketValueInr])

  const cumulativeMetalCostSteps = useMemo(() => {
    const sorted = [...ledger].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    const steps: number[] = []
    let cum = 0
    for (const r of sorted) {
      const raw = r.gold_value_inr_pre_gst?.trim()
      cum += raw ? Number.parseFloat(raw) : 0
      steps.push(cum)
    }
    return steps
  }, [ledger])

  return (
    <div className="dash-panel-max pf-scope">
      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <div className="pf-groww-shell pf-stagger">
        <PortfolioSpotPillsRow spot={spotPayload} tickerFallback={goldTickerFallback} />

        <DashboardActions
          title="Quick moves"
          actions={[
            { label: 'Check holdings', description: `${activeVaultCount} active vaults`, tone: 'primary', onClick: () => setPortfolioTab('active') },
            { label: 'Track personal gold', description: 'Add off-platform items', onClick: () => setPortfolioTab('personal') },
            { label: 'Review ledger', description: 'Recent credits and redemptions', onClick: () => setPortfolioTab('transactions') },
          ]}
          aside={totalGrams > 0 ? `${totalGrams.toFixed(4)} g total` : undefined}
        />

        <nav ref={portfolioTabsRef} className="pf-groww-tabs" aria-label="Portfolio sections">
          {(
            [
              ['overview', 'Overview'],
              ['active', 'Active'],
              ['personal', 'Personal'],
              ['transactions', 'Transactions'],
              ['charts', 'Charts'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`pf-groww-tab${portfolioTab === id ? ' pf-groww-tab--active' : ''}`}
              onClick={() => setPortfolioTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {portfolioTab === 'overview' ? (
          <>
            <PortfolioGrowwHero
              activeVaultCount={activeVaultCount}
              totalGrams={totalGrams}
              marketValueInr={marketValueInr}
              allocatedCost={allocatedCost}
              pnlInr={pnlInr}
              pnlPct={Number.isFinite(pnlPct) ? pnlPct : null}
              masked={privacyMasked}
              onToggleMask={() => setPrivacyMasked((m) => !m)}
              portfolioTotalGrams={totals ? parseG(totals.total_gold_grams ?? '0') : null}
              portfolioTotalInr={totals ? parseInrNum(totals.total_estimated_value_inr ?? '0') : null}
              personalGrams={totals ? parseG(totals.personal_grams ?? '0') : null}
              summaryChartSlot={
                heldGramsSum > 0 ? (
                  sessionValueSamples.length === 0 ? (
                    <p className="pf-groww-hero__chart-wait">Sampling live valuation…</p>
                  ) : (
                    <PortfolioLiveValueVsCostChart
                      samples={sessionValueSamples}
                      investedInr={allocatedCost}
                      formatInrAxis={(n) =>
                        privacyMasked
                          ? '••••'
                          : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                      }
                    />
                  )
                ) : undefined
              }
            />

            <PortfolioVaultHoldingsList
              vaults={vaults}
              allocatedCost={allocatedCost}
              totalHeldGrams={heldGramsSum}
              masked={privacyMasked}
            />

            {unrealized?.basis_note || wallet?.cridora_member_id || totals ? (
              <details className="dash-disclosure">
                <summary>Portfolio notes</summary>
                <div className="dash-disclosure__body">
                  {totals ? (
                    <p className="pf-groww-footnote" style={{ marginTop: 0 }}>
                      Total metal includes Cridora vaults and personal tracked items.
                    </p>
                  ) : null}
                  {unrealized?.basis_note ? <p className="pf-groww-footnote">{unrealized.basis_note}</p> : null}
                  {wallet?.cridora_member_id ? (
                    <p className="pf-groww-footnote">
                      Member ID <strong className="tabular">{wallet.cridora_member_id}</strong>
                    </p>
                  ) : null}
                </div>
              </details>
            ) : null}
          </>
        ) : null}

        {portfolioTab === 'charts' ? (
          <div className="pf-grid pf-grid--charts pf-groww-charts-grid">
            <article className="pf-card pf-card--lift pf-card--wide">
              <header className="pf-card__head">
                <h3 className="pf-card__title">Portfolio performance · INR</h3>
                <p className="pf-card__meta">
                  Metal cost basis vs live vault mark‑to‑market from jeweller ₹/g (not a historical NAV curve).
                </p>
              </header>
              <div className="pf-card__viz pf-card__viz--mkt-board">
                <PortfolioCostVsMarketBoard
                  allocatedCost={allocatedCost}
                  marketValue={marketValueInr}
                  pnlInr={pnlInr}
                  pnlPct={Number.isFinite(pnlPct) ? pnlPct : null}
                  cumulativeMetalCostSteps={cumulativeMetalCostSteps}
                />
              </div>
            </article>

            <article className="pf-card pf-card--lift">
              <header className="pf-card__head">
                <h3 className="pf-card__title">Grams per jeweller</h3>
                <p className="pf-card__meta">All vaulted metal by custodian (fractional, deposit, scheme)</p>
              </header>
              <div className="pf-card__viz">
                {vaultBarVals.length > 0 && vaultBarVals.some((v) => v > 0) ? (
                  <PortfolioBarChart
                    values={vaultBarVals}
                    labels={vaultBarLabels}
                    colors={vaultBarLabels.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]!)}
                    ariaLabel="Bar chart of total vaulted grams per jeweller"
                  />
                ) : (
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    No vaulted grams yet — buy fractional gold or complete a gold deposit with a verified jeweller.
                  </p>
                )}
              </div>
            </article>

            <article className="pf-card pf-card--lift pf-card--wide">
              <header className="pf-card__head">
                <h3 className="pf-card__title">Allocation by jeweller</h3>
                <p className="pf-card__meta">Share of your total vaulted grams (all holding types)</p>
              </header>
              <div className="pf-donut-wrap">
                <PortfolioDonut segments={donutSegs} ariaLabel="Vault metal allocation by jeweller" />
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
        ) : null}

        {portfolioTab === 'active' ? (
          <div>
            <CustomerVaultsPanel />
          </div>
        ) : null}

        {portfolioTab === 'personal' ? <CustomerPersonalHoldingsPanel onChanged={refresh} /> : null}

        {portfolioTab === 'transactions' ? (
          <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger-table-wrap">
            <header className="pf-card__head pf-ledger-head">
              <div>
                <h3 className="pf-card__title">Ledger</h3>
                <p className="pf-card__meta">Filter by movement type.</p>
              </div>
            </header>
            <div className="pf-ledger-filter" role="group" aria-label="Ledger filter">
              {(
                [
                  ['all', 'All'],
                  ['fractional', 'Fractional'],
                  ['deposit', 'Deposit'],
                  ['golden_scheme', 'Golden scheme'],
                  ['transfer', 'Transfers'],
                  ['sellback', 'Redemptions'],
                  ['redemption_purchase', 'Vault shop'],
                  ['cridorapay_purchase', 'CridoraPay'],
                  ['personal', 'Personal'],
                  ['loan', 'Loans'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn btn-sm${ledgerFilter === id ? ' btn-primary' : ' btn-ghost'}`}
                  onClick={() => setLedgerFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {ledgerLoading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : ledgerEntries.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No rows for this filter.</p>
            ) : (
              <div className="pf-ledger-scroll">
                <table className="pf-ledger-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Label</th>
                      <th>Jeweller</th>
                      <th className="tabular">Grams</th>
                      <th className="tabular">Est. ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((row) => (
                      <tr
                        key={`${row.reference}-${row.transaction_type}-${row.occurred_at}`}
                        className="pf-ledger-row"
                      >
                        <td className="pf-ledger-date">{fmtWhen(row.occurred_at)}</td>
                        <td>
                          <span className={portfolioLedgerPillClass(row.transaction_type)}>
                            {formatPortfolioLedgerTxnType(row.transaction_type)}
                          </span>
                        </td>
                        <td className="tabular">{row.reference}</td>
                        <td>{row.label}</td>
                        <td>{row.jeweller_name || '—'}</td>
                        <td className="tabular pf-ledger-grams">{parseG(row.grams).toFixed(6)} g</td>
                        <td className="tabular pf-ledger-inr">₹{fmtInrPlain(row.current_value_inr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        ) : null}
      </div>
    </div>
  )
}
