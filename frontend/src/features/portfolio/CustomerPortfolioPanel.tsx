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

function fmtInrWhole(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtSignedInr(n: number): string {
  const sign = n >= 0 ? '+' : '-'
  const v = Math.abs(n)
  return `${sign}₹${fmtInrWhole(v)}`
}

function parseInrNum(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
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

  const activeVaultCount = useMemo(
    () => vaults.filter((v) => parseG(v.fractional_grams) > 0).length,
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

  const inrTrendMini = useMemo(() => {
    if (estInr <= 0 && allocatedCost <= 0) return [0, 0]
    if (allocatedCost > 0) return [Math.round(allocatedCost), Math.round(estInr)]
    return [Math.round(estInr * 0.94), Math.round(estInr)]
  }, [estInr, allocatedCost])

  const ledgerDisplay = useMemo(() => ledgerRowsWithRunningBal(ledger), [ledger])

  return (
    <div className="dash-panel-max pf-scope">
      <p className="dash-panel-lead pf-lead-intro">
        Live vault balances, estimated mark-to-market from jewellers&apos; quoted ₹/g, and unrealized profit or loss vs the
        purchase cost allocated from your completed fractional buys.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <div className="pf-grid pf-grid--kpis pf-stagger">
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--gold">
          <span className="pf-kpi__eyebrow">Total gold</span>
          <p className="pf-kpi__value">{`${totalGrams.toFixed(6)} g`}</p>
          <span className="pf-kpi__hint">
            {activeVaultCount} jeweller vault{activeVaultCount === 1 ? '' : 's'} · synced
          </span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--ocean">
          <span className="pf-kpi__eyebrow">Estimated value</span>
          <p className="pf-kpi__value">
            ₹{estInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <span className="pf-kpi__hint">Vault mark-to-market (today&apos;s jeweller rates)</span>
        </div>
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--iris">
          <span className="pf-kpi__eyebrow">Allocated cost</span>
          <p className="pf-kpi__value tabular">₹{fmtInrWhole(allocatedCost)}</p>
          <span className="pf-kpi__hint">Purchase basis matched to current holdings</span>
        </div>
        <div
          className={`pf-kpi pf-kpi--pulse ${pnlInr >= 0 ? 'pf-kpi--mint' : 'pf-kpi--rose'}`}
          style={{
            borderColor: pnlInr >= 0 ? 'rgba(52, 211, 153, 0.35)' : 'rgba(244, 114, 182, 0.35)',
          }}
        >
          <span className="pf-kpi__eyebrow">Unrealized P&amp;L</span>
          <p
            className="pf-kpi__value tabular"
            style={{ color: pnlInr >= 0 ? 'var(--success)' : 'var(--danger)' }}
          >
            {fmtSignedInr(pnlInr)}
          </p>
          <span className="pf-kpi__hint">
            {Number.isFinite(pnlPct) && allocatedCost > 0 ? (
              <>
                <span className="tabular">{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</span> on allocated cost ·{' '}
              </>
            ) : null}
            {ledger.length} completed purchase{ledger.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {unrealized?.basis_note ? (
        <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {unrealized.basis_note}
        </p>
      ) : null}

      {wallet?.cridora_member_id ? (
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Cridora member ID <strong className="tabular">{wallet.cridora_member_id}</strong>
        </p>
      ) : null}

      <div className="pf-grid pf-grid--charts pf-stagger">
        <article className="pf-card pf-card--lift">
          <header className="pf-card__head">
            <h3 className="pf-card__title">Cost vs market (INR)</h3>
            <p className="pf-card__meta">
              Allocated purchase basis vs estimated vault value from jeweller ₹/g marks (not historical NAV)
            </p>
          </header>
          <div className="pf-card__viz">
            <PortfolioTrendChart
              values={inrTrendMini}
              stroke="#fcd34d"
              fillId="customer-area-portfolio-live"
              ariaLabel="Trend from allocated cost to estimated vault INR value"
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
