import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchGoldWallet, type FractionalLedgerRowDTO, type VaultRowDTO } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { PortfolioBarChart, PortfolioDonut, PortfolioTrendChart } from './PortfolioCharts'

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

export function CustomerPortfolioPanel() {
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof fetchGoldWallet>>>(null)
  const [loadErr, setLoadErr] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const w = await fetchGoldWallet()
    if (!w) {
      setLoadErr('Could not load wallet.')
      setWallet(null)
      return
    }
    setWallet(w)
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

  const inrTrendMini = useMemo(() => {
    if (estInr <= 0) return [0, 0]
    return [Math.round(estInr * 0.94), Math.round(estInr)]
  }, [estInr])

  const ledgerDisplay = useMemo(() => ledgerRowsWithRunningBal(ledger), [ledger])

  return (
    <div className="dash-panel-max pf-scope">
      <p className="dash-panel-lead pf-lead-intro">
        Live vault balances and completed fractional purchases. Estimated INR sums jewellers&apos; quoted rates on your
        holdings; profit/loss history requires time-series data not yet exposed.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <div className="pf-grid pf-grid--kpis pf-stagger">
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--gold">
          <span className="pf-kpi__eyebrow">Total gold</span>
          <p className="pf-kpi__value">{`${totalGrams.toFixed(6)} g`}</p>
          <span className="pf-kpi__hint">Fractional vault total (synced)</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--ocean">
          <span className="pf-kpi__eyebrow">Estimated value</span>
          <p className="pf-kpi__value">
            ₹{estInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <span className="pf-kpi__hint">Sum of vault mark-to-market estimates</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--iris">
          <span className="pf-kpi__eyebrow">Vaults</span>
          <p className="pf-kpi__value">{vaults.filter((v) => parseG(v.fractional_grams) > 0).length}</p>
          <span className="pf-kpi__hint">Jewellers with fractional balance</span>
        </div>
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--mint">
          <span className="pf-kpi__eyebrow">Purchases on record</span>
          <p className="pf-kpi__value">{ledger.length}</p>
          <span className="pf-kpi__hint">Completed fractional orders (shown below)</span>
        </div>
      </div>

      {wallet?.cridora_member_id ? (
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Cridora member ID <strong className="tabular">{wallet.cridora_member_id}</strong>
        </p>
      ) : null}

      <div className="pf-grid pf-grid--charts pf-stagger">
        <article className="pf-card pf-card--lift">
          <header className="pf-card__head">
            <h3 className="pf-card__title">Estimated INR snapshot</h3>
            <p className="pf-card__meta">Two-point pulse from current vault marks (not historical NAV)</p>
          </header>
          <div className="pf-card__viz">
            <PortfolioTrendChart
              values={inrTrendMini}
              stroke="#fcd34d"
              fillId="customer-area-portfolio-live"
              ariaLabel="Minimal trend from estimated portfolio INR"
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
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No fractional grams yet — buy gold from a verified jeweller.</p>
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

      <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger-table-wrap pf-stagger">
        <header className="pf-card__head pf-ledger-head">
          <div>
            <h3 className="pf-card__title">Ledger — fractional purchases</h3>
            <p className="pf-card__meta">Completed orders credited to your vault (counter / legacy UPI).</p>
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
                  <th className="tabular">Paid</th>
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
                    <td className="tabular pf-ledger-inr pf-ledger-inr--out">₹{fmtInrPlain(row.total_inr)}</td>
                    <td className="tabular pf-ledger-bal">{row.balanceG}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  )
}
