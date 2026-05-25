import { useId, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { FractionalLedgerRowDTO, GoldWalletDTO, PortfolioTotalsDTO } from '@/lib/goldTransferApi'
import { vaultRowTotalGrams, type VaultRowDTO } from '@/lib/goldTransferApi'
import type { SpotPricesPayload } from '@/lib/marketplaceApi'
import { PortfolioDonut, PortfolioTrendChart } from './PortfolioCharts'

const DONUT_COLORS = ['#c9a840', '#3b9eff', '#67e8f9', '#a78bfa', '#34d399', '#f472b6', '#38bdf8']

function parseG(s: string | undefined): number {
  const n = Number.parseFloat(String(s ?? '0'))
  return Number.isFinite(n) ? n : 0
}

function fmtInr(n: number, masked: boolean): string {
  if (masked) return '••••'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtInrMaskedStr(s: string, masked: boolean): string {
  if (masked) return '••••'
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: n >= 100 ? 0 : 2 })
}

function fmtGramsMasked(n: number, masked: boolean, digits = 3): string {
  if (masked) return '••••'
  return `${n.toFixed(digits)}`
}

function fmtWhenLedger(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso.slice(0, 10)
  return new Date(t).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

function spot22PerG(payload: SpotPricesPayload | null | undefined): number | null {
  const raw = payload?.gold?.['22K']
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  return null
}

export function CustomerPortfolioOverviewDash(props: {
  wallet: GoldWalletDTO | null
  spotPayload: SpotPricesPayload | null
  totals: PortfolioTotalsDTO | null
  vaults: VaultRowDTO[]
  fractionalLedger: FractionalLedgerRowDTO[]
  marketValueInr: number
  allocatedCost: number
  totalGrams: number
  heldGramsSum: number
  pnlInr: number
  pnlPct: number | null
  masked: boolean
  sessionSamples: number[]
  kycVerified: boolean
  onViewLedger: () => void
  onTogglePrivacy: () => void
}) {
  const chartGradId = useId().replace(/:/g, '')
  const {
    wallet,
    spotPayload,
    totals,
    vaults,
    fractionalLedger,
    marketValueInr,
    allocatedCost,
    totalGrams,
    heldGramsSum,
    pnlInr,
    pnlPct,
    masked,
    sessionSamples,
    kycVerified,
    onViewLedger,
    onTogglePrivacy,
  } = props

  const donutSegs = useMemo(() => {
    if (vaults.length === 0) {
      return [{ pct: 1, color: '#475569', label: 'No vault holdings yet' }]
    }
    const sumVaultGrams = vaults.reduce((acc, v) => acc + Math.max(0, vaultRowTotalGrams(v)), 0)
    const denom = sumVaultGrams > 1e-9 ? sumVaultGrams : 1
    return vaults.map((v, i) => ({
      pct: Math.max(0, vaultRowTotalGrams(v)) / denom,
      color: DONUT_COLORS[i % DONUT_COLORS.length]!,
      label: v.custodian_label || `Jeweller ${v.custodian_id}`,
    }))
  }, [vaults])

  const fracG = totals ? parseG(totals.vault_fractional_grams) : vaults.reduce((a, v) => a + parseG(v.fractional_grams), 0)
  const depG = totals ? parseG(totals.vault_deposit_grams) : vaults.reduce((a, v) => a + parseG(v.deposit_grams ?? '0'), 0)
  const schemeG = totals ? parseG(totals.vault_golden_scheme_grams) : vaults.reduce((a, v) => a + parseG(v.golden_scheme_grams ?? '0'), 0)
  const lockedLoanG = totals ? parseG(totals.loan_collateral_locked_grams) : 0
  const redeemG = Math.max(0, heldGramsSum - lockedLoanG)
  const live22 = spot22PerG(spotPayload)
  const activePartners = vaults.filter((v) => vaultRowTotalGrams(v) > 0.000001).length

  const chartValues =
    sessionSamples.length > 1 ? sessionSamples : sessionSamples.length === 1 ? [sessionSamples[0]!, sessionSamples[0]!] : []

  const heroTrendValues = useMemo(() => {
    if (chartValues.length > 0) {
      const cap = 36
      return chartValues.slice(-Math.min(chartValues.length, cap))
    }
    if (masked) {
      return [98, 100, 99, 101, 102, 101.5, 102.2]
    }
    if (marketValueInr > 0) {
      const jitter = Math.max(marketValueInr * 0.0045, 1)
      const v = marketValueInr
      return [v - jitter * 2.8, v - jitter * 1.2, v + jitter * 0.35, v - jitter * 0.65, v + jitter * 0.85, v]
    }
    return [1, 1, 1.01, 1]
  }, [chartValues, marketValueInr, masked])

  const recentTx = [...fractionalLedger]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 5)

  return (
    <>
      <div className="ph">
        <h1>Portfolio Overview</h1>
        <p>Live valuation, P&amp;L, and transaction history across all partner jewellers.</p>
      </div>

      <div className="hero mb20">
        <div className="row row-b wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div className="hero-eyebrow">Total vaulted gold</div>
            <div className="hero-grams">
              {fmtGramsMasked(totalGrams, masked, 3)}
              <span className="unit">g</span>
            </div>
            <div className="hero-inr" style={{ marginTop: 6 }}>
              ≈ ₹{fmtInr(marketValueInr, masked)} at today&apos;s board rate
            </div>
          </div>
          <div className="row wrap" style={{ alignSelf: 'flex-start', gap: 8 }}>
            {kycVerified ? (
              <span className="bdg bdg-ok" style={{ padding: '4px 10px', fontSize: '0.64rem' }}>
                KYC verified
              </span>
            ) : (
              <span className="bdg bdg-warn" style={{ padding: '4px 10px', fontSize: '0.64rem' }}>
                KYC pending
              </span>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onTogglePrivacy}>
              {masked ? 'Show' : 'Hide'} balances
            </button>
            <Link to="/userdashboard?section=invest_fractional" className="btn btn-primary btn-sm">
              + Buy gold
            </Link>
          </div>
        </div>

        <div className="pf-hero-trend-wrap">
          <PortfolioTrendChart
            values={heroTrendValues}
            stroke="#c9a840"
            fillId={`${chartGradId}_hero_sg`}
            ariaLabel={
              masked
                ? 'Vault valuation trend (balances hidden)'
                : 'Approximate vault valuation trend this session'
            }
          />
        </div>

        <div className="hero-grid">
          <div className="hero-stat">
            <div className="hs-lbl">Invested</div>
            <div className="hs-val tn">₹{fmtInr(allocatedCost, masked)}</div>
          </div>
          <div className="hero-stat">
            <div className="hs-lbl">Unrealised P/L</div>
            <div className={`hs-val tn${pnlInr >= 0 ? ' c-ok' : ' c-err'}`}>
              {pnlInr >= 0 ? '+' : '−'}₹{fmtInr(Math.abs(pnlInr), masked)}
              {pnlPct != null && Number.isFinite(pnlPct) ? (
                <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>
                  {' '}
                  ({pnlInr >= 0 ? '+' : ''}
                  {pnlPct.toFixed(2)}%)
                </span>
              ) : null}
            </div>
          </div>
          <div className="hero-stat">
            <div className="hs-lbl">Redeemable</div>
            <div className="hs-val c-gold tn">{fmtGramsMasked(redeemG, masked, 3)} g</div>
          </div>
          <div className="hero-stat">
            <div className="hs-lbl">Locked in loan</div>
            <div className="hs-val c-warn tn">{fmtGramsMasked(lockedLoanG, masked, 3)} g</div>
          </div>
        </div>
      </div>

      <div className="stat-row mb20">
        <div className="stat a">
          <div className="stat-lbl">Fractional gold</div>
          <div className="stat-val c-gold tn">
            {fmtGramsMasked(fracG, masked, 3)}
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink2)' }}> g</span>
          </div>
          <div className="stat-sub">{activePartners} partner jeweller{activePartners === 1 ? '' : 's'}</div>
        </div>
        <div className="stat b">
          <div className="stat-lbl">Gold deposit</div>
          <div className="stat-val c-ok tn">
            {fmtGramsMasked(depG, masked, 3)}
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink2)' }}> g</span>
          </div>
          <div className="stat-sub">Physical digitised</div>
        </div>
        <div className="stat c">
          <div className="stat-lbl">Golden scheme</div>
          <div className="stat-val tn" style={{ color: 'var(--info)' }}>
            {fmtGramsMasked(schemeG, masked, 3)}
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink2)' }}> g</span>
          </div>
          <div className="stat-sub">Recurring plan</div>
        </div>
        <div className="stat d">
          <div className="stat-lbl">Live 22K rate</div>
          <div className="stat-val c-gold tn">
            {live22 != null ? `₹${live22.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
          </div>
          <div className="stat-sub">Updates every ~30s</div>
        </div>
      </div>

      <div className="g2 mb20">
        <div className="card card-p">
          <div className="row-b mb12">
            <div>
              <div className="sec-title">Portfolio performance</div>
              <div className="sec-sub t-fa fs11">INR · session</div>
            </div>
            {pnlPct != null && Number.isFinite(pnlPct) ? (
              <span className={`bdg${pnlPct >= 0 ? ' bdg-ok' : ' bdg-err'}`}>
                {pnlPct >= 0 ? '+' : ''}
                {pnlPct.toFixed(2)}%
              </span>
            ) : (
              <span className="bdg bdg-grey">—</span>
            )}
          </div>
          {chartValues.length > 0 ? (
            <PortfolioTrendChart
              values={chartValues}
              stroke="#c9a840"
              fillId={`cdpf_${chartGradId}`}
              ariaLabel="Approximate live vault valuation samples this session"
            />
          ) : (
            <p className="t-fa fs11" style={{ margin: 0 }}>
              Valuation samples appear after your balance updates.
            </p>
          )}
        </div>

        <div className="card card-p">
          <div className="sec-title mb12">Allocation by jeweller</div>
            <div className="row wrap" style={{ alignItems: 'center', gap: 20 }}>
            <div className="dash-donut-slot" style={{ flexShrink: 0 }}>
              <PortfolioDonut segments={donutSegs} ariaLabel="Gram allocation by custodian jeweller" />
            </div>
            <div className="stack" style={{ gap: 10, fontSize: '0.76rem' }}>
              {donutSegs.slice(0, 4).map((s) => (
                <div key={s.label} className="row" style={{ alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      background: s.color,
                      flexShrink: 0,
                    }}
                  />
                  <span className="t-mu">
                    {s.label}
                    <br />
                    <strong className="tn" style={{ color: s.color }}>
                      {(heldGramsSum * s.pct).toFixed(2)} g — {Math.round(s.pct * 100)}%
                    </strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="hr" />
          <div
            className="pf-mini-gram-strip"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, fontSize: '0.72rem', textAlign: 'center' }}
          >
            <div>
              <div className="t-fa fw7" style={{ fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Fractional
              </div>
              <div className="fw7 t-go tn">{fmtGramsMasked(fracG, masked, 2)} g</div>
            </div>
            <div>
              <div className="t-fa fw7" style={{ fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Deposit
              </div>
              <div className="fw7 c-ok tn">{fmtGramsMasked(depG, masked, 2)} g</div>
            </div>
            <div>
              <div className="t-fa fw7" style={{ fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Scheme
              </div>
              <div className="fw7 tn" style={{ color: 'var(--info)' }}>
                {fmtGramsMasked(schemeG, masked, 2)} g
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row-b" style={{ padding: '16px 20px 12px' }}>
          <div className="sec-title">Recent transactions</div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onViewLedger}>
            View all
          </button>
        </div>
        <div className="tbl-wrap">
          {recentTx.length === 0 ? (
            <div className="empty" style={{ border: 'none', margin: 16 }}>
              <div className="empty-ico" aria-hidden>
                📜
              </div>
              <h3>No purchases yet</h3>
              <p>Fractional buys and deposits appear here.</p>
            </div>
          ) : (
            <table className="tbl tbl-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Jeweller</th>
                  <th>Grams</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.map((row, idx) => (
                  <tr key={`${row.reference}-${idx}-${row.created_at}`}>
                    <td className="tx">{fmtWhenLedger(row.created_at)}</td>
                    <td>
                      <span className="bdg bdg-gold">Fractional</span>
                    </td>
                    <td className="tn">{row.reference}</td>
                    <td>{row.jeweller_name}</td>
                    <td className="tn c-gold">+{masked ? '••••' : `${parseG(row.grams).toFixed(3)}`} g</td>
                    <td className="tn">₹{fmtInrMaskedStr(row.total_inr, masked)}</td>
                    <td>
                      <span className="bdg bdg-ok">Done</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {wallet?.cridora_member_id ? (
        <p className="t-fa fs11 mt16" style={{ marginBottom: 0 }}>
          Member ID <strong className="tn">{wallet.cridora_member_id}</strong>
        </p>
      ) : null}
    </>
  )
}
