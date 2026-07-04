import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchGoldWallet, vaultRowEstimatedInr, vaultRowTotalGrams, type VaultRowDTO } from '@/lib/goldTransferApi'
import {
  fetchPersonalHoldings,
  fetchPortfolioLedger,
  type PersonalHoldingDTO,
  type PortfolioLedgerEntryDTO,
} from '@/lib/personalHoldingsApi'
import { loadHoldingsScopePref, persistHoldingsScope, type HoldingsScope } from './holdingsScope'
import { CustomerPortfolioOverviewDash } from './CustomerPortfolioOverviewDash'
import {
  fetchSpotPrices,
  fetchGoldTicker,
  fetchGoldTickerHistory,
  type GoldTickerPayload,
  type GoldTickerHistoryPayload,
  type SpotPricesPayload,
} from '@/lib/marketplaceApi'
import { useCustomerKycOk } from '@/hooks/useCustomerKycOk'
import { useLivePoll } from '@/lib/useLivePoll'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import {
  PortfolioBarChart,
  PortfolioCostVsMarketBoard,
  PortfolioDonut,
  PortfolioHistoryValuationChart,
  buildPortfolioHoldingsValueSeries,
  type PortfolioHistoryRangeKey,
} from './PortfolioCharts'
import { dashboardCopy } from '@/content/dashboardCopy'
import { PortfolioLiveGoldPriceCard } from './PortfolioLiveGoldPriceCard'
import { CustomerVaultsPanel } from './CustomerVaultsPanel'
import { CustomerPersonalHoldingsPanel } from './CustomerPersonalHoldingsPanel'
import { TablePagination } from '@/components/ui'
import { useTablePagination } from '@/hooks/useTablePagination'

const LEDGER_PAGE_SZ = 10
const DONUT_COLORS = ['#fbbf24', '#d4a85c', '#67e8f9', '#a78bfa', '#34d399', '#f472b6', '#38bdf8']
function safeMoneyStr(s?: string | null): number {
  const n = Number.parseFloat(String(s ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

function resolveLive22kPerGram(spot: SpotPricesPayload | null, tickerFallback: GoldTickerPayload | null): number | null {
  const g22Raw = spot?.gold?.['22K']
  if (typeof g22Raw === 'number' && Number.isFinite(g22Raw)) return g22Raw
  const p = spot?.platform_base_inr_per_gram_22k
  if (p) {
    const n = Number.parseFloat(p)
    if (Number.isFinite(n)) return n
  }
  if (tickerFallback) {
    const n = Number.parseFloat(tickerFallback.platform_base_inr_per_gram_22k)
    if (Number.isFinite(n)) return n
  }
  return null
}

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

export function CustomerPortfolioPanel({ defaultPortfolioTab }: { defaultPortfolioTab?: PortfolioTabId }) {
  const kycVerified = useCustomerKycOk()
  const [searchParams, setSearchParams] = useSearchParams()
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof fetchGoldWallet>>>(null)
  const [spotPayload, setSpotPayload] = useState<SpotPricesPayload | null>(null)
  const [goldTickerFallback, setGoldTickerFallback] = useState<GoldTickerPayload | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [privacyMasked, setPrivacyMasked] = useState(false)
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTabId>('overview')
  const [ledgerFilter, setLedgerFilter] = useState('all')
  const [ledgerEntries, setLedgerEntries] = useState<PortfolioLedgerEntryDTO[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [portfolioHistRange, setPortfolioHistRange] = useState<PortfolioHistoryRangeKey>('1w')
  const [portfolioHistPayload, setPortfolioHistPayload] = useState<GoldTickerHistoryPayload | null>(null)
  const [portfolioHistLoading, setPortfolioHistLoading] = useState(false)
  const [holdingsScope, setHoldingsScope] = useState<HoldingsScope>(loadHoldingsScopePref)
  const [personalPreview, setPersonalPreview] = useState<PersonalHoldingDTO[]>([])
  const [personalHoldingsCount, setPersonalHoldingsCount] = useState(0)
  const [personalInitialAction, setPersonalInitialAction] = useState<'add' | 'scan' | null>(null)
  const portfolioTabsRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    persistHoldingsScope(holdingsScope)
  }, [holdingsScope])

  const refreshPersonalPreview = useCallback(async () => {
    const r = await fetchPersonalHoldings()
    if (!r) {
      setPersonalPreview([])
      setPersonalHoldingsCount(0)
      return
    }
    const list = r.results ?? []
    setPersonalHoldingsCount(list.length)
    setPersonalPreview(list.slice(0, 3))
  }, [])

  const navigatePersonalAction = useCallback(
    (action: 'add' | 'scan') => {
      setPersonalInitialAction(action)
      setPortfolioTab('personal')
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          // portfolio_tab=personal is reserved for overview + personal scope deeplinks.
          // Vault actions use portfolio_action only so clearing it does not bounce back to overview.
          next.set('portfolio_action', action)
          if (action === 'scan') next.delete('scan')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clearPersonalInitialAction = useCallback(() => {
    setPersonalInitialAction(null)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('portfolio_action')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const refresh = useCallback(async () => {
    setLoadErr('')
    const [w, sp] = await Promise.all([fetchGoldWallet(), fetchSpotPrices()])
    void refreshPersonalPreview()
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
  }, [refreshPersonalPreview])

  useEffect(() => {
    const raw = (searchParams.get('portfolio_tab') || '').trim().toLowerCase()
    const actionRaw = (searchParams.get('portfolio_action') || '').trim().toLowerCase()
    const hasScan = searchParams.get('scan') === '1'
    const hasHolding = Boolean((searchParams.get('holding') || '').trim())
    const openPersonalVault =
      defaultPortfolioTab === 'personal' ||
      actionRaw === 'add' ||
      actionRaw === 'scan' ||
      hasScan ||
      hasHolding

    if (actionRaw === 'add' || actionRaw === 'scan') {
      setPersonalInitialAction(actionRaw)
    } else if (hasScan) {
      setPersonalInitialAction('scan')
    }

    if (openPersonalVault) {
      setPortfolioTab('personal')
    } else if (raw === 'documents') {
      setPortfolioTab('personal')
    } else if (raw === 'personal') {
      // Push/deep links use portfolio_tab=personal for overview + personal scope, not the vault tab.
      setPortfolioTab('overview')
      setHoldingsScope('personal')
    } else if (raw) {
      const allowed = new Set(['overview', 'active', 'personal', 'transactions', 'charts'])
      if (allowed.has(raw)) {
        setPortfolioTab(raw as PortfolioTabId)
      } else if (defaultPortfolioTab) {
        setPortfolioTab(defaultPortfolioTab)
      }
    } else if (defaultPortfolioTab) {
      setPortfolioTab(defaultPortfolioTab)
    }
  }, [searchParams, defaultPortfolioTab])

  useEffect(() => {
    const nav = portfolioTabsRef.current
    if (!nav) return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 721px)').matches) return
    const active = nav.querySelector('.tab-btn.on')
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

  const ledgerPg = useTablePagination(ledgerEntries.length, LEDGER_PAGE_SZ)
  const ledgerPageRows = ledgerPg.active
    ? ledgerEntries.slice(ledgerPg.sliceStart, ledgerPg.sliceEnd)
    : ledgerEntries

  useEffect(() => {
    if (portfolioTab !== 'overview' && portfolioTab !== 'charts') return
    let cancelled = false
    setPortfolioHistLoading(true)
    void fetchGoldTickerHistory(portfolioHistRange).then((payload) => {
      if (!cancelled) {
        setPortfolioHistPayload(payload)
        setPortfolioHistLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [portfolioTab, portfolioHistRange])

  useEffect(() => {
    if (portfolioTab !== 'overview' && portfolioTab !== 'charts') return
    const id = window.setInterval(() => {
      void fetchGoldTickerHistory(portfolioHistRange).then(setPortfolioHistPayload)
    }, 60_000)
    return () => clearInterval(id)
  }, [portfolioTab, portfolioHistRange])

  const vaults = wallet?.vaults ?? []
  const ledger = wallet?.fractional_ledger ?? []
  const totalGramsStr = wallet?.balance_grams ?? '0'
  const totalGrams = parseG(totalGramsStr)
  const estInr = fmtInrSum(vaults)

  const heldGramsSum = useMemo(
    () => vaults.reduce((acc, v) => acc + Math.max(0, vaultRowTotalGrams(v)), 0),
    [vaults],
  )

  const donutSegs = useMemo(() => {
    if (vaults.length === 0) {
      return [{ pct: 1, color: '#475569', label: dashboardCopy.customer.empty.vaultDonutLabel }]
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
  const allocatedTotalPaid = unrealized
    ? parseInrNum(unrealized.allocated_total_paid_inr ?? '')
    : 0

  const marketValueInr = useMemo(() => {
    const raw = unrealized?.market_value_inr?.trim()
    if (raw) {
      const n = Number.parseFloat(raw)
      if (Number.isFinite(n)) return n
    }
    return estInr
  }, [unrealized?.market_value_inr, estInr])

  const pt = wallet?.portfolio_totals

  const vaultGramsPortfolio = useMemo(() => {
    if (pt?.cridora_active_grams != null && String(pt.cridora_active_grams).trim() !== '') {
      return parseG(pt.cridora_active_grams)
    }
    return heldGramsSum > 1e-9 ? heldGramsSum : totalGrams
  }, [pt, heldGramsSum, totalGrams])

  const personalGramsPortfolio = useMemo(() => safeMoneyStr(pt?.personal_grams ?? undefined), [pt])

  const fullGramsPortfolio = useMemo(() => {
    if (pt?.total_gold_grams != null && String(pt.total_gold_grams).trim() !== '') {
      return parseG(pt.total_gold_grams)
    }
    return vaultGramsPortfolio + personalGramsPortfolio
  }, [pt, vaultGramsPortfolio, personalGramsPortfolio])

  const personalValueInrPortfolio = useMemo(() => safeMoneyStr(pt?.personal_estimated_value_inr), [pt])

  const fullMarketValuePortfolio = useMemo(() => {
    if (pt?.total_estimated_value_inr != null && String(pt.total_estimated_value_inr).trim() !== '') {
      return safeMoneyStr(pt.total_estimated_value_inr)
    }
    return marketValueInr + personalValueInrPortfolio
  }, [pt, marketValueInr, personalValueInrPortfolio])

  const personalRecordedBasisInr = useMemo(() => safeMoneyStr(pt?.personal_recorded_cost_basis_inr), [pt])

  const personalPurchaseTotalInr = useMemo(
    () => safeMoneyStr(pt?.personal_recorded_purchase_total_inr),
    [pt],
  )

  const personalPnLInrPortfolio = useMemo(() => safeMoneyStr(pt?.personal_gain_on_recorded_cost_inr), [pt])

  const fullAllocatedPortfolio = allocatedCost + personalRecordedBasisInr

  const fullTotalPaidPortfolio = allocatedTotalPaid + personalPurchaseTotalInr

  const fullPnLPortfolio = pnlInr + personalPnLInrPortfolio

  const fullPnLPctPortfolio = useMemo(() => {
    if (fullAllocatedPortfolio <= 0) return NaN
    return (fullPnLPortfolio / fullAllocatedPortfolio) * 100
  }, [fullAllocatedPortfolio, fullPnLPortfolio])

  const personalPnLPctPortfolio = useMemo(() => {
    if (personalRecordedBasisInr <= 0) return NaN
    return (personalPnLInrPortfolio / personalRecordedBasisInr) * 100
  }, [personalRecordedBasisInr, personalPnLInrPortfolio])

  const isPersonalScope = holdingsScope === 'personal'

  const displayPortfolioGrams = isPersonalScope ? personalGramsPortfolio : fullGramsPortfolio

  const displayPortfolioMarketInr = isPersonalScope ? personalValueInrPortfolio : fullMarketValuePortfolio

  const displayPortfolioAllocated = isPersonalScope ? personalRecordedBasisInr : fullAllocatedPortfolio

  const displayPortfolioTotalPaid = isPersonalScope ? personalPurchaseTotalInr : fullTotalPaidPortfolio

  const displayPortfolioPnlInr = isPersonalScope ? personalPnLInrPortfolio : fullPnLPortfolio

  const displayPortfolioPnlPct = isPersonalScope
    ? Number.isFinite(personalPnLPctPortfolio)
      ? personalPnLPctPortfolio
      : null
    : Number.isFinite(fullPnLPctPortfolio)
      ? fullPnLPctPortfolio
      : null

  const showHoldingsScopeToggle = wallet != null

  const live22PerGramPortfolio = useMemo(
    () => resolveLive22kPerGram(spotPayload, goldTickerFallback),
    [spotPayload, goldTickerFallback],
  )

  const portfolioHistPoints = useMemo(
    () => buildPortfolioHoldingsValueSeries(portfolioHistPayload, displayPortfolioGrams, live22PerGramPortfolio),
    [portfolioHistPayload, displayPortfolioGrams, live22PerGramPortfolio],
  )

  const portfolioHistGranularity: 'intraday' | 'daily' =
    portfolioHistPayload?.granularity === 'intraday' ? 'intraday' : 'daily'

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
        <nav ref={portfolioTabsRef} className="tabs" aria-label="Portfolio sections">
          {(
            [
              ['overview', 'Overview'],
              ['active', 'Active'],
              [
                'personal',
                personalHoldingsCount > 0 ? `My gold · ${personalHoldingsCount}` : 'My gold',
              ],
              ['transactions', 'Transactions'],
              ['charts', 'Charts'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`tab-btn${portfolioTab === id ? ' on' : ''}`}
              onClick={() => setPortfolioTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {portfolioTab === 'overview' ? (
          <>
            <CustomerPortfolioOverviewDash
              wallet={wallet}
              spotPayload={spotPayload}
              totals={wallet?.portfolio_totals ?? null}
              vaults={vaults}
              fractionalLedger={ledger}
              heldGramsSum={heldGramsSum}
              summaryGrams={displayPortfolioGrams}
              summaryMarketValueInr={displayPortfolioMarketInr}
              summaryAllocatedCost={displayPortfolioAllocated}
              summaryTotalPaidInr={displayPortfolioTotalPaid}
              summaryPnlInr={displayPortfolioPnlInr}
              summaryPnlPct={displayPortfolioPnlPct}
              vaultGramsPortfolio={vaultGramsPortfolio}
              personalGramsPortfolio={personalGramsPortfolio}
              personalValueInrPortfolio={personalValueInrPortfolio}
              personalHoldingsCount={personalHoldingsCount}
              personalPreview={personalPreview}
              holdingsScope={holdingsScope}
              onHoldingsScopeChange={setHoldingsScope}
              showHoldingsScopeToggle={showHoldingsScopeToggle}
              onNavigatePersonalAction={navigatePersonalAction}
              onViewPersonal={() => setPortfolioTab('personal')}
              masked={privacyMasked}
              portfolioHistoryPoints={portfolioHistPoints}
              portfolioHistoryGranularity={portfolioHistGranularity}
              portfolioHistoryRange={portfolioHistRange}
              portfolioHistoryLoading={portfolioHistLoading}
              onPortfolioHistoryRangeChange={setPortfolioHistRange}
              kycVerified={kycVerified}
              onViewLedger={() => setPortfolioTab('transactions')}
              onTogglePrivacy={() => setPrivacyMasked((m) => !m)}
            />

            <PortfolioLiveGoldPriceCard
              spot={spotPayload}
              tickerFallback={goldTickerFallback}
              holdingsGrams={displayPortfolioGrams}
              holdingsValueInr={displayPortfolioMarketInr}
              masked={privacyMasked}
            />

            {unrealized?.basis_note ? (
              <details className="dash-disclosure" style={{ marginTop: '1.25rem' }}>
                <summary>Portfolio methodology</summary>
                <div className="dash-disclosure__body">
                  <p className="pf-groww-footnote" style={{ marginTop: 0 }}>
                    {unrealized.basis_note}
                  </p>
                </div>
              </details>
            ) : null}
          </>
        ) : null}

        {portfolioTab === 'charts' ? (
          <div className="pf-grid pf-grid--charts pf-groww-charts-grid">
            <article className="pf-card pf-card--lift pf-card--wide">
              <header className="pf-card__head">
                <h3 className="pf-card__title">Historical valuation curve</h3>
                <p className="pf-card__meta">
                  Cridora 22K board-rate history × current holdings grams (1D / 1W / 1M / 1Y). Dashed baseline: invested
                  metal cost. Green tint above tends to unrealised profit at that sample; red below toward unrealised
                  loss. Today&apos;s gram total is scaled across all points — past quantity changes aren&apos;t stepped
                  in.
                </p>
              </header>
              <div className="pf-card__viz pf-history-valuation-card-slot">
                <PortfolioHistoryValuationChart
                  points={portfolioHistPoints}
                  investedInr={displayPortfolioAllocated}
                  granularity={portfolioHistGranularity}
                  rangeKey={portfolioHistRange}
                  onRangeChange={setPortfolioHistRange}
                  masked={privacyMasked}
                  loading={portfolioHistLoading}
                  holdingsGrams={displayPortfolioGrams}
                  ariaLead="Historical estimated portfolio INR versus invested baseline from stored board-rate samples."
                />
              </div>
            </article>

            <article className="pf-card pf-card--lift pf-card--wide">
              <header className="pf-card__head">
                <h3 className="pf-card__title">Portfolio performance · INR</h3>
                <p className="pf-card__meta">
                  Metal cost basis vs live vault mark‑to‑market from jeweller ₹/g (not a historical NAV curve).
                </p>
              </header>
              <div className="pf-card__viz pf-card__viz--mkt-board">
                <PortfolioCostVsMarketBoard
                  allocatedCost={displayPortfolioAllocated}
                  marketValue={displayPortfolioMarketInr}
                  pnlInr={displayPortfolioPnlInr}
                  pnlPct={displayPortfolioPnlPct}
                  cumulativeMetalCostSteps={isPersonalScope ? [] : cumulativeMetalCostSteps}
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
                  <p style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
                    {dashboardCopy.customer.empty.vaultGrams}
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

        {portfolioTab === 'personal' ? (
          <CustomerPersonalHoldingsPanel
            onChanged={refresh}
            initialAction={personalInitialAction}
            onInitialActionConsumed={clearPersonalInitialAction}
          />
        ) : null}

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
                    {ledgerPageRows.map((row) => (
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
                {ledgerPg.active ? (
                  <TablePagination
                    page={ledgerPg.page}
                    totalPages={ledgerPg.totalPages}
                    totalItems={ledgerEntries.length}
                    pageSize={ledgerPg.pageSize}
                    onPrev={() => ledgerPg.setPage((p) => Math.max(0, p - 1))}
                    onNext={() => ledgerPg.setPage((p) => Math.min(ledgerPg.totalPages - 1, p + 1))}
                    className="pf-ledger-pagination"
                  />
                ) : null}
              </div>
            )}
          </article>
        ) : null}
      </div>
    </div>
  )
}
