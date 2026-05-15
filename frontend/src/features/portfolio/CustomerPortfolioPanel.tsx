import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchGoldWallet, type FractionalLedgerRowDTO, type VaultRowDTO } from '@/lib/goldTransferApi'
import { fetchGoldTicker, fetchSpotPrices, type GoldTickerPayload, type SpotPricesPayload } from '@/lib/marketplaceApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { PortfolioBarChart, PortfolioCostVsMarketBoard, PortfolioDonut } from './PortfolioCharts'
import {
  PortfolioGrowwHeaderBar,
  PortfolioGrowwHero,
  PortfolioSpotPillsRow,
  PortfolioVaultHoldingsList,
} from './PortfolioGrowwViews'

const DONUT_COLORS = ['#fbbf24', '#d4a85c', '#67e8f9', '#a78bfa', '#34d399', '#f472b6', '#38bdf8']

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

function ledgerRowsWithRunningBal(rows: FractionalLedgerRowDTO[]): Array<FractionalLedgerRowDTO & { balanceG: string }> {
  const chrono = [...rows].reverse()
  let bal = 0
  const out: Array<FractionalLedgerRowDTO & { balanceG: string }> = []
  for (const r of chrono) {
    bal += parseG(r.grams)
    out.push({ ...r, balanceG: `${bal.toFixed(6)} g` })
  }
  return out.reverse()
}

function parseInrNum(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function CustomerPortfolioPanel() {
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof fetchGoldWallet>>>(null)
  const [spotPayload, setSpotPayload] = useState<SpotPricesPayload | null>(null)
  const [goldTickerFallback, setGoldTickerFallback] = useState<GoldTickerPayload | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [privacyMasked, setPrivacyMasked] = useState(false)
  const [portfolioTab, setPortfolioTab] = useState<'overview' | 'charts' | 'ledger'>('overview')

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
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  const vaults = wallet?.vaults ?? []
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

  const ledgerDisplay = useMemo(() => ledgerRowsWithRunningBal(ledger), [ledger])

  return (
    <div className="dash-panel-max pf-scope">
      <p className="dash-panel-lead pf-lead-intro">
        Live vault balances, estimated mark-to-market from jewellers&apos; quoted ₹/g, and unrealized profit or loss vs your
        allocated <strong>metal purchase cost</strong> (gold value before GST; invoice totals incl. GST appear in the ledger).
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <div className="pf-groww-shell pf-stagger">
        <PortfolioGrowwHeaderBar />

        <PortfolioSpotPillsRow spot={spotPayload} tickerFallback={goldTickerFallback} />

        <nav className="pf-groww-tabs" aria-label="Portfolio sections">
          {(
            [
              ['overview', 'Overview'],
              ['charts', 'Charts'],
              ['ledger', 'Ledger'],
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

        {portfolioTab === 'ledger' ? (
          <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger-table-wrap">
            <header className="pf-card__head pf-ledger-head">
              <div>
                <h3 className="pf-card__title">Ledger — fractional purchases</h3>
                <p className="pf-card__meta">
                  Completed orders: metal ₹ before GST vs invoice total (incl. GST); allocation uses metal ₹ for P&amp;L above.
                </p>
              </div>
            </header>
            {ledgerDisplay.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No completed purchases yet.</p>
            ) : (
              <div className="pf-ledger-scroll">
                <table className="pf-ledger-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Activity</th>
                      <th>Reference</th>
                      <th>Jeweller</th>
                      <th className="tabular">Grams</th>
                      <th className="tabular">Metal (pre‑GST)</th>
                      <th className="tabular">Total (incl. GST)</th>
                      <th className="tabular">Gold bal.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerDisplay.map((row) => (
                      <tr key={row.reference} className="pf-ledger-row">
                        <td className="pf-ledger-date">{fmtWhen(row.created_at)}</td>
                        <td>
                          <span className="pf-ledger-pill pf-ledger-pill--buy">buy</span>
                        </td>
                        <td className="tabular">{row.reference}</td>
                        <td>{row.jeweller_name}</td>
                        <td className="tabular pf-ledger-grams">+{parseG(row.grams).toFixed(6)} g</td>
                        <td className="tabular pf-ledger-inr">
                          {row.gold_value_inr_pre_gst != null && String(row.gold_value_inr_pre_gst).trim() !== ''
                            ? `₹${fmtInrPlain(row.gold_value_inr_pre_gst)}`
                            : '—'}
                        </td>
                        <td className="tabular pf-ledger-inr pf-ledger-inr--out">₹{fmtInrPlain(row.total_inr)}</td>
                        <td className="tabular pf-ledger-bal">{row.balanceG}</td>
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
