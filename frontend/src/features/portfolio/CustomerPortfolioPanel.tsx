import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchGoldWallet, type VaultRowDTO } from '@/lib/goldTransferApi'
import { fetchPortfolioLedger, type PortfolioLedgerEntryDTO } from '@/lib/personalHoldingsApi'
import { CustomerPersonalHoldingsPanel, CustomerVaultDocumentsTab } from '@/features/portfolio/CustomerPersonalHoldingsPanel'
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

const DONUT_COLORS = ['#fbbf24', '#d4a85c', '#67e8f9', '#a78bfa', '#34d399', '#f472b6', '#38bdf8']
const SESSION_VALUE_SAMPLES_CAP = 56

type PortfolioTabId = 'overview' | 'active' | 'personal' | 'documents' | 'charts' | 'transactions'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function fmtInrSum(vaults: VaultRowDTO[]): number {
  let t = 0
  for (const v of vaults) {
    t += parseG(v.estimated_fractional_value_inr ?? '0')
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
    const allowed = new Set(['overview', 'active', 'personal', 'documents', 'transactions', 'charts'])
    if (raw && allowed.has(raw)) {
      setPortfolioTab(raw as PortfolioTabId)
    }
  }, [searchParams])

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
    () => vaults.filter((v) => parseG(v.fractional_grams) > 0).length,
    [vaults],
  )

  const heldGramsSum = useMemo(
    () => vaults.reduce((acc, v) => acc + Math.max(0, parseG(v.fractional_grams)), 0),
    [vaults],
  )

  const donutSegs = useMemo(() => {
    if (vaults.length === 0) {
      return [{ pct: 1, color: '#475569', label: 'No vault holdings yet' }]
    }
    const grams = vaults.map((v) => Math.max(0, parseG(v.fractional_grams)))
    const sum = grams.reduce((a, b) => a + b, 0) || 1
    return vaults.map((v, i) => ({
      pct: Math.max(0, parseG(v.fractional_grams)) / sum,
      color: DONUT_COLORS[i % DONUT_COLORS.length]!,
      label: v.custodian_label || `Jeweller ${v.custodian_id}`,
    }))
  }, [vaults])

  const vaultBarVals = useMemo(() => vaults.map((v) => parseG(v.fractional_grams)), [vaults])
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

        <nav className="pf-groww-tabs" aria-label="Portfolio sections">
          {(
            [
              ['overview', 'Overview'],
              ['active', 'Active'],
              ['personal', 'Personal'],
              ['documents', 'Documents'],
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
            {totals ? (
              <div className="pf-wealth-kpis" aria-label="Total wealth summary">
                <div className="pf-wealth-kpi pf-wealth-kpi--lead">
                  <span className="pf-wealth-kpi__eyebrow">Total gold</span>
                  <p className="pf-wealth-kpi__val tabular">{parseG(totals.total_gold_grams ?? '0').toFixed(3)} g</p>
                  <p className="pf-wealth-kpi__hint">Vault + personal records</p>
                </div>
                <div className="pf-wealth-kpi">
                  <span className="pf-wealth-kpi__eyebrow">Cridora holdings</span>
                  <p className="pf-wealth-kpi__val tabular">{parseG(totals.cridora_active_grams ?? '0').toFixed(3)} g</p>
                  <p className="pf-wealth-kpi__hint">Active vault balances</p>
                </div>
                <div className="pf-wealth-kpi">
                  <span className="pf-wealth-kpi__eyebrow">Personal holdings</span>
                  <p className="pf-wealth-kpi__val tabular">{parseG(totals.personal_grams ?? '0').toFixed(3)} g</p>
                  <p className="pf-wealth-kpi__hint">Physical gold you track</p>
                </div>
                <div className="pf-wealth-kpi">
                  <span className="pf-wealth-kpi__eyebrow">Total est. value</span>
                  <p className="pf-wealth-kpi__val tabular">
                    ₹
                    {parseInrNum(totals.total_estimated_value_inr ?? '0').toLocaleString('en-IN', {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p className="pf-wealth-kpi__hint">Indicative · ref. ₹{totals.reference_gold_inr_per_gram_22k ?? '—'}/g 22K</p>
                </div>
                {totals.personal_recorded_cost_basis_inr &&
                parseInrNum(totals.personal_recorded_cost_basis_inr) > 0 ? (
                  <>
                    <div className="pf-wealth-kpi">
                      <span className="pf-wealth-kpi__eyebrow">Personal · recorded cost</span>
                      <p className="pf-wealth-kpi__val tabular">
                        ₹
                        {parseInrNum(totals.personal_recorded_cost_basis_inr).toLocaleString('en-IN', {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                      <p className="pf-wealth-kpi__hint">Σ weight × ₹/g you entered</p>
                    </div>
                    <div className="pf-wealth-kpi">
                      <span className="pf-wealth-kpi__eyebrow">Personal · ref. gain</span>
                      <p
                        className={`pf-wealth-kpi__val tabular${
                          parseInrNum(totals.personal_gain_on_recorded_cost_inr ?? '0') < 0
                            ? ' pf-wealth-kpi__val--neg'
                            : ''
                        }`}
                      >
                        ₹
                        {parseInrNum(totals.personal_gain_on_recorded_cost_inr ?? '0').toLocaleString('en-IN', {
                          maximumFractionDigits: 0,
                        })}
                        {totals.personal_gain_on_recorded_cost_percent ? (
                          <>
                            {' '}
                            (<span className="tabular">{totals.personal_gain_on_recorded_cost_percent}</span>%)
                          </>
                        ) : null}
                      </p>
                      <p className="pf-wealth-kpi__hint">vs purchase ₹/g at platform reference mark</p>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            {totals ? (
              <p className="pf-groww-footnote" style={{ marginTop: '0.15rem', marginBottom: '1rem' }}>
                Total metal combines balances held with jewellers on Cridora plus personal items you track. Reference ₹/g on personal rows
                is the platform 22K mark — not your store&apos;s invoice rate. Optional purchase ₹/g unlocks indicative gain vs that reference.
              </p>
            ) : null}
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

            {unrealized?.basis_note ? (
              <p className="pf-groww-footnote">{unrealized.basis_note}</p>
            ) : null}

            {wallet?.cridora_member_id ? (
              <p className="pf-groww-footnote">
                Cridora member ID <strong className="tabular">{wallet.cridora_member_id}</strong>
              </p>
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
                <p className="pf-card__meta">Fractional holdings by custodian vault</p>
              </header>
              <div className="pf-card__viz">
                {vaultBarVals.length > 0 && vaultBarVals.some((v) => v > 0) ? (
                  <PortfolioBarChart
                    values={vaultBarVals}
                    labels={vaultBarLabels}
                    colors={vaultBarLabels.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]!)}
                    ariaLabel="Bar chart of fractional grams per jeweller vault"
                  />
                ) : (
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    No fractional grams yet — buy gold from a verified jeweller.
                  </p>
                )}
              </div>
            </article>

            <article className="pf-card pf-card--lift pf-card--wide">
              <header className="pf-card__head">
                <h3 className="pf-card__title">Allocation by jeweller</h3>
                <p className="pf-card__meta">Share of your total fractional grams</p>
              </header>
              <div className="pf-donut-wrap">
                <PortfolioDonut segments={donutSegs} ariaLabel="Fractional gold allocation by jeweller vault" />
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
            <p className="dash-panel-lead" style={{ marginBottom: '1rem' }}>
              <strong>Active Cridora holdings</strong> — vaulted fractional, deposit, and scheme grams with your partner jewellers.{' '}
              Personal physical gold lives under the Personal tab (tracking-only in MVP).
            </p>
            <CustomerVaultsPanel />
          </div>
        ) : null}

        {portfolioTab === 'personal' ? <CustomerPersonalHoldingsPanel onChanged={refresh} /> : null}

        {portfolioTab === 'documents' ? (
          <article className="pf-card pf-card--lift pf-card--wide" style={{ padding: '1.15rem 1.25rem' }}>
            <CustomerVaultDocumentsTab />
          </article>
        ) : null}

        {portfolioTab === 'transactions' ? (
          <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger-table-wrap">
            <header className="pf-card__head pf-ledger-head">
              <div>
                <h3 className="pf-card__title">Portfolio ledger</h3>
                <p className="pf-card__meta">
                  Filter by holding type. Personal rows use platform reference ₹/g; vault rows use live marks where applicable.
                </p>
              </div>
            </header>
            <div className="pf-ledger-filter" role="group" aria-label="Ledger filter">
              {(
                [
                  ['all', 'All'],
                  ['fractional', 'Fractional'],
                  ['deposit', 'Deposit'],
                  ['golden_scheme', 'Golden scheme'],
                  ['personal', 'Personal'],
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
                      <tr key={`${row.reference}-${row.occurred_at}`} className="pf-ledger-row">
                        <td className="pf-ledger-date">{fmtWhen(row.occurred_at)}</td>
                        <td>
                          <span className="pf-ledger-pill pf-ledger-pill--buy">{row.transaction_type}</span>
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
