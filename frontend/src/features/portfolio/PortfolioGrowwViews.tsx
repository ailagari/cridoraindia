import { useMemo, useState } from 'react'
import type { GoldTickerPayload, SpotPricesPayload } from '@/lib/marketplaceApi'
import type { VaultRowDTO } from '@/lib/goldTransferApi'
import { VaultTrendSparkline } from './PortfolioCharts'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function fmtInr2(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function maskInr(s: string): string {
  return s.replace(/[0-9]/g, '•')
}

function numFromGold(block: Record<string, number> | undefined, key: string): number | null {
  if (!block) return null
  const v = block[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function SvgIconSearch(props: { size?: number }) {
  const s = props.size ?? 20
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.2-4.2" strokeLinecap="round" />
    </svg>
  )
}

function SvgIconEye(props: { size?: number }) {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function SvgIconDots(props: { size?: number }) {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}

function SvgIconChevronDown(props: { size?: number }) {
  const s = props.size ?? 14
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SvgIconSort(props: { size?: number }) {
  const s = props.size ?? 12
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 6h12M8 12h8M8 18h4" strokeLinecap="round" />
      <path d="M4 8V4M4 4L6 6M4 4 2 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SvgIconGrid(props: { size?: number }) {
  const s = props.size ?? 12
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

export function PortfolioSpotPillsRow({
  spot,
  tickerFallback,
}: {
  spot: SpotPricesPayload | null
  tickerFallback: GoldTickerPayload | null
}) {
  let g22: number | null = numFromGold(spot?.gold, '22K')
  let g24: number | null = numFromGold(spot?.gold, '24K')

  if (spot == null && tickerFallback != null) {
    const p = Number.parseFloat(tickerFallback.platform_base_inr_per_gram_22k)
    if (Number.isFinite(p)) {
      g22 = p
      g24 = p / 0.916
    }
  }

  const pills = [
    { label: 'Gold · 22K', sub: 'Published ₹/g', val: g22 },
    { label: 'Gold · 24K', sub: 'Derived ₹/g', val: g24 },
  ]

  return (
    <div className="pf-groww-pills" role="region" aria-label="Published platform gold rates">
      {pills.map((p) => (
        <div key={p.label} className="pf-groww-pill">
          <span className="pf-groww-pill__tag">{p.label}</span>
          <div className="pf-groww-pill__body">
            <span className="pf-groww-pill__val tabular">
              {p.val != null ? `₹${fmtInr2(p.val)}` : '—'}
            </span>
            <span className="pf-groww-pill__hint">{p.sub}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PortfolioGrowwHero({
  activeVaultCount,
  totalGrams,
  marketValueInr,
  allocatedCost,
  pnlInr,
  pnlPct,
  masked,
  onToggleMask,
}: {
  activeVaultCount: number
  totalGrams: number
  marketValueInr: number
  allocatedCost: number
  pnlInr: number
  pnlPct: number | null
  masked: boolean
  onToggleMask: () => void
}) {

  const mainVal = `₹${fmtInr2(marketValueInr)}`
  const investVal = `₹${fmtInr2(allocatedCost)}`
  const retTxt =
    allocatedCost > 0 && pnlPct != null && Number.isFinite(pnlPct)
      ? `${pnlInr >= 0 ? '+' : '−'}₹${fmtInr2(Math.abs(pnlInr))} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`
      : `${pnlInr >= 0 ? '+' : '−'}₹${fmtInr2(Math.abs(pnlInr))}`

  const disp = (s: string) => (masked ? maskInr(s) : s)

  return (
    <section className="pf-groww-hero" aria-label="Portfolio summary">
      <div className="pf-groww-hero__top">
        <div>
          <div className="pf-groww-hero__eyebrow">
            <span>Vault holdings ({activeVaultCount})</span>
            <SvgIconChevronDown />
          </div>
          <p className="pf-groww-hero__grams tabular">{`${totalGrams.toFixed(6)} g`} total gold</p>
          <p className="pf-groww-hero__big tabular">{disp(mainVal)}</p>
          <p className="pf-groww-hero__sub">Live vault mark‑to‑market (jeweller ₹/g)</p>
        </div>
        <div className="pf-groww-hero__actions">
          <button
            type="button"
            className="pf-groww-icon-btn"
            aria-pressed={masked}
            aria-label={masked ? 'Show amounts' : 'Hide amounts'}
            onClick={() => onToggleMask()}
          >
            <SvgIconEye />
          </button>
          <button type="button" className="pf-groww-icon-btn" aria-label="More options (display only)">
            <SvgIconDots />
          </button>
        </div>
      </div>

      <div className="pf-groww-hero__divider" />

      <div className="pf-groww-hero__stats">
        <div className="pf-groww-hero__stat">
          <span className="pf-groww-hero__stat-label">Metal cost basis</span>
          <span className="pf-groww-hero__stat-val tabular">{disp(investVal)}</span>
        </div>
        <div className="pf-groww-hero__stat">
          <span className="pf-groww-hero__stat-label">Unrealized return</span>
          <span
            className={`pf-groww-hero__stat-val tabular ${pnlInr >= 0 ? 'pf-groww-hero__stat-val--up' : 'pf-groww-hero__stat-val--down'}`}
          >
            {masked ? maskInr(retTxt) : retTxt}
          </span>
        </div>
      </div>
    </section>
  )
}

type VaultRowComputed = {
  key: string
  name: string
  grams: number
  market: number
  investedShare: number
  trend: 'up' | 'down' | 'neutral'
  ratePerG: string | null
}

export function PortfolioVaultHoldingsList({
  vaults,
  allocatedCost,
  totalHeldGrams,
  masked,
}: {
  vaults: VaultRowDTO[]
  allocatedCost: number
  totalHeldGrams: number
  masked: boolean
}) {
  const [sortBy, setSortBy] = useState<'value' | 'name'>('value')

  const rows = useMemo(() => {
    const held = vaults.filter((v) => parseG(v.fractional_grams) > 0)
    const denom = totalHeldGrams > 0 ? totalHeldGrams : 1
    const out: VaultRowComputed[] = held.map((v) => {
      const grams = parseG(v.fractional_grams)
      const market = parseG(v.estimated_fractional_value_inr ?? '0')
      const investedShare =
        allocatedCost > 0 && totalHeldGrams > 0 ? (allocatedCost * grams) / denom : 0
      let trend: VaultRowComputed['trend'] = 'neutral'
      if (investedShare > 0) {
        const ratio = market / investedShare
        if (ratio > 1.002) trend = 'up'
        else if (ratio < 0.998) trend = 'down'
      } else if (market > 0) trend = 'up'

      const rate = v.jeweller_metal_rate_inr_per_gram?.trim()
      let ratePerG: string | null = null
      if (rate) {
        const n = Number.parseFloat(rate)
        ratePerG = Number.isFinite(n) ? `₹${fmtInr2(n)}/g` : rate
      }

      return {
        key: v.vault_public_id,
        name: v.custodian_label?.trim() || `Jeweller ${v.custodian_id}`,
        grams,
        market,
        investedShare,
        trend,
        ratePerG,
      }
    })
    out.sort((a, b) =>
      sortBy === 'name' ? a.name.localeCompare(b.name) : b.market - a.market,
    )
    return out
  }, [vaults, allocatedCost, totalHeldGrams, sortBy])

  const disp = (s: string) => (masked ? maskInr(s) : s)

  return (
    <section className="pf-groww-holdings" aria-label="Holdings by vault">
      <div className="pf-groww-holdings__bar">
        <button
          type="button"
          className={`pf-groww-mini-sort ${sortBy === 'value' ? 'pf-groww-mini-sort--on' : ''}`}
          onClick={() => setSortBy('value')}
        >
          Sort <SvgIconSort /> · value
        </button>
        <button
          type="button"
          className={`pf-groww-mini-sort ${sortBy === 'name' ? 'pf-groww-mini-sort--on' : ''}`}
          onClick={() => setSortBy('name')}
        >
          <SvgIconGrid /> · name
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="pf-groww-holdings__empty">No vault holdings yet — buy fractional gold from a verified jeweller.</p>
      ) : (
        <ul className="pf-groww-holdings__list">
          {rows.map((r) => (
            <li key={r.key} className="pf-groww-holding-row">
              <div className="pf-groww-holding-row__left">
                <h4 className="pf-groww-holding-row__title">{r.name}</h4>
                <span className="pf-groww-holding-row__meta tabular">
                  {r.grams.toFixed(4)} g
                  {r.ratePerG ? ` · ${r.ratePerG}` : ''}
                </span>
              </div>
              <div className="pf-groww-holding-row__spark" aria-hidden>
                <VaultTrendSparkline trend={r.trend} />
              </div>
              <div className="pf-groww-holding-row__right">
                <span className={`pf-groww-holding-row__cur tabular ${r.trend === 'down' ? 'pf-groww-holding-row__cur--down' : r.trend === 'up' ? 'pf-groww-holding-row__cur--up' : ''}`}>
                  {disp(`₹${fmtInr2(r.market)}`)}
                </span>
                <span className="pf-groww-holding-row__inv tabular">
                  ({disp(`₹${fmtInr2(r.investedShare)}`)} cost share)
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="pf-groww-holdings__fineprint">
        Cost share splits your total metal basis by grams per vault (estimate). Sparklines are illustrative, not historical
        prices.
      </p>
    </section>
  )
}

export function PortfolioGrowwHeaderBar() {
  return (
    <header className="pf-groww-topbar">
      <div className="pf-groww-topbar__brand">
        <div className="pf-groww-topbar__orb" aria-hidden>
          <span className="pf-groww-topbar__orb-dot" />
        </div>
        <div>
          <h2 className="pf-groww-topbar__title">Portfolio</h2>
          <p className="pf-groww-topbar__sub">Gold · vaults · live marks</p>
        </div>
      </div>
      <div className="pf-groww-topbar__tools">
        <span className="pf-groww-topbar__ico" aria-hidden>
          <SvgIconSearch />
        </span>
      </div>
    </header>
  )
}
