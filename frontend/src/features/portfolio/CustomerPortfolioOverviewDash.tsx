import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { dashboardCopy } from '@/content/dashboardCopy'
import { TablePagination } from '@/components/ui'
import type { FractionalLedgerRowDTO, GoldWalletDTO, PortfolioTotalsDTO } from '@/lib/goldTransferApi'
import { vaultRowTotalGrams, type VaultRowDTO } from '@/lib/goldTransferApi'
import type { PersonalHoldingDTO } from '@/lib/personalHoldingsApi'
import type { SpotPricesPayload } from '@/lib/marketplaceApi'
import type { HoldingsScope } from './holdingsScope'
import {
  PortfolioDonut,
  PortfolioHistoryValuationChart,
  type PortfolioHistoryRangeKey,
  type PortfolioHistoryValuePoint,
} from './PortfolioCharts'
import { useTablePagination } from '@/hooks/useTablePagination'

const DONUT_COLORS = ['#c9a840', '#3b9eff', '#67e8f9', '#a78bfa', '#34d399', '#f472b6', '#38bdf8']

const OV_RECENT_TX_PAGE = 5
const copy = dashboardCopy.customer

function useIsMobileViewport(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

function parseG(s: string | undefined): number {
  const n = Number.parseFloat(String(s ?? '0'))
  return Number.isFinite(n) ? n : 0
}

function parseN(s: string): number {
  const n = Number.parseFloat(s)
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
  heldGramsSum: number
  summaryGrams: number
  summaryMarketValueInr: number
  summaryAllocatedCost: number
  summaryTotalPaidInr: number
  summaryPnlInr: number
  summaryPnlPct: number | null
  vaultGramsPortfolio: number
  personalGramsPortfolio: number
  personalValueInrPortfolio: number
  personalHoldingsCount: number
  personalPreview: PersonalHoldingDTO[]
  holdingsScope: HoldingsScope
  onHoldingsScopeChange: (scope: HoldingsScope) => void
  showHoldingsScopeToggle: boolean
  onNavigatePersonalAction: (action: 'add' | 'scan') => void
  onViewPersonal: () => void
  masked: boolean
  portfolioHistoryPoints: PortfolioHistoryValuePoint[]
  portfolioHistoryGranularity: 'intraday' | 'daily'
  portfolioHistoryRange: PortfolioHistoryRangeKey
  portfolioHistoryLoading: boolean
  onPortfolioHistoryRangeChange: (next: PortfolioHistoryRangeKey) => void
  kycVerified: boolean
  onViewLedger: () => void
  onTogglePrivacy: () => void
}) {
  const {
    wallet,
    spotPayload,
    totals,
    vaults,
    fractionalLedger,
    heldGramsSum,
    summaryGrams,
    summaryMarketValueInr,
    summaryAllocatedCost,
    summaryTotalPaidInr,
    summaryPnlInr,
    summaryPnlPct,
    vaultGramsPortfolio,
    personalGramsPortfolio,
    personalValueInrPortfolio,
    personalHoldingsCount,
    personalPreview,
    holdingsScope,
    onHoldingsScopeChange,
    showHoldingsScopeToggle,
    onNavigatePersonalAction,
    onViewPersonal,
    masked,
    portfolioHistoryPoints,
    portfolioHistoryGranularity,
    portfolioHistoryRange,
    portfolioHistoryLoading,
    onPortfolioHistoryRangeChange,
    kycVerified,
    onViewLedger,
    onTogglePrivacy,
  } = props

  const [trackMenuOpen, setTrackMenuOpen] = useState(false)
  const trackMenuRef = useRef<HTMLDivElement>(null)
  const isMobileViewport = useIsMobileViewport()
  const isPersonalScope = holdingsScope === 'personal'

  const closeTrackMenu = () => setTrackMenuOpen(false)

  const openTrackMenu = () => setTrackMenuOpen(true)

  const navigateTrackAction = (action: 'add' | 'scan') => {
    closeTrackMenu()
    onNavigatePersonalAction(action)
  }

  useEffect(() => {
    if (!trackMenuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (isMobileViewport) return
      const el = trackMenuRef.current
      if (el && !el.contains(e.target as Node)) closeTrackMenu()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTrackMenu()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [trackMenuOpen, isMobileViewport])

  useEffect(() => {
    if (!trackMenuOpen || !isMobileViewport) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [trackMenuOpen, isMobileViewport])

  const donutSegs = useMemo(() => {
    if (vaults.length === 0) {
      return [{ pct: 1, color: '#475569', label: dashboardCopy.customer.empty.vaultDonutLabel }]
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

  const recentTxSorted = useMemo(
    () => [...fractionalLedger].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [fractionalLedger],
  )
  const recentPg = useTablePagination(recentTxSorted.length, OV_RECENT_TX_PAGE)
  const recentTxRows = recentPg.active
    ? recentTxSorted.slice(recentPg.sliceStart, recentPg.sliceEnd)
    : recentTxSorted

  const showPersonalPreview =
    isPersonalScope || personalGramsPortfolio > 1e-6 || personalHoldingsCount === 0

  const heroEyebrow = isPersonalScope ? 'Personal gold holdings' : 'Total gold holdings'

  return (
    <>
      <div className="ph pf-portfolio-page-head">
        <h1>Portfolio</h1>
        <p className="pf-portfolio-page-head__sub">Live value, P&amp;L, and your gold at home and with jewellers.</p>
      </div>

      <div className="hero mb20 pf-portfolio-hero">
        <div className="pf-portfolio-hero__summary">
          <div className="hero-eyebrow">{heroEyebrow}</div>
          <div className="hero-grams pf-portfolio-grams--gold-glow">
            {fmtGramsMasked(summaryGrams, masked, 3)}
            <span className="unit">g</span>
          </div>
          <div className="hero-inr pf-portfolio-hero__inr">
            ≈ ₹{fmtInr(summaryMarketValueInr, masked)} at today&apos;s board rate
          </div>
          {!isPersonalScope && personalGramsPortfolio > 1e-6 ? (
            <div className="pf-portfolio-hero__hint t-fa fs11">
              Vault &amp; jewellers{' '}
              <strong className="tn" style={{ color: 'var(--gold-hi)' }}>
                {fmtGramsMasked(vaultGramsPortfolio, masked, 3)} g
              </strong>
              {' · '}Personal{' '}
              <strong className="tn">{fmtGramsMasked(personalGramsPortfolio, masked, 3)} g</strong>
            </div>
          ) : null}
          {isPersonalScope && vaultGramsPortfolio > 1e-6 ? (
            <div className="pf-portfolio-hero__hint t-fa fs11 pf-holdings-scope-hint">
              {copy.holdingsScope.vaultContext}:{' '}
              <strong className="tn">{fmtGramsMasked(vaultGramsPortfolio, masked, 3)} g</strong>
              {' · '}
              <button
                type="button"
                className="pf-holdings-scope-hint__link"
                onClick={() => onHoldingsScopeChange('all')}
              >
                {copy.holdingsScope.switchToAll}
              </button>
            </div>
          ) : null}
        </div>

        {showHoldingsScopeToggle ? (
          <div className="pf-portfolio-hero__scope pf-holdings-scope-wrap">
            <div
              className="pf-holdings-scope-toggle"
              role="group"
              aria-label="Holdings to include in totals"
            >
              <button
                type="button"
                className={`pf-holdings-scope-toggle__btn${isPersonalScope ? ' is-active' : ''}`}
                onClick={() => onHoldingsScopeChange('personal')}
                aria-pressed={isPersonalScope}
                title={copy.holdingsScope.personalHint}
              >
                {copy.holdingsScope.personal}
              </button>
              <button
                type="button"
                className={`pf-holdings-scope-toggle__btn${!isPersonalScope ? ' is-active' : ''}`}
                onClick={() => onHoldingsScopeChange('all')}
                aria-pressed={!isPersonalScope}
                title={copy.holdingsScope.allHint}
              >
                {copy.holdingsScope.all}
              </button>
            </div>
            <p className="pf-holdings-scope-toggle__sub t-fa fs11">
              {isPersonalScope ? copy.holdingsScope.personalHint : copy.holdingsScope.allHint}
            </p>
          </div>
        ) : null}

        <div className="pf-portfolio-hero__toolbar">
          <div className="pf-portfolio-hero__actions-primary">
            <div className="pf-track-gold-split" ref={trackMenuRef}>
              <button
                type="button"
                className="pf-track-gold-split__main"
                onClick={() => (isMobileViewport ? openTrackMenu() : navigateTrackAction('add'))}
              >
                <span className="pf-track-gold-split__icon" aria-hidden>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M10 3v14M3 10h14" strokeLinecap="round" />
                  </svg>
                </span>
                {copy.personalOverview.trackGold}
              </button>
              <div className={`pf-track-gold-split__menu${trackMenuOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="pf-track-gold-split__chev"
                  aria-expanded={trackMenuOpen}
                  aria-haspopup="menu"
                  aria-label="More ways to track gold"
                  onClick={() => (trackMenuOpen ? closeTrackMenu() : openTrackMenu())}
                >
                  <svg
                    className="pf-track-gold-split__chev-icon"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden
                  >
                    <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {!isMobileViewport ? (
                  <div
                    className="pf-track-gold-split__dropdown"
                    role="menu"
                    hidden={!trackMenuOpen}
                  >
                    <p className="pf-track-gold-split__dropdown-label t-fa">Add personal gold</p>
                    <button
                      type="button"
                      className="pf-track-gold-split__item pf-track-gold-split__item--featured"
                      role="menuitem"
                      onClick={() => navigateTrackAction('scan')}
                    >
                      <span className="pf-track-gold-split__item-icon pf-track-gold-split__item-icon--scan" aria-hidden>
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="5" width="14" height="11" rx="1.5" />
                          <path d="M7 3h6M10 3v2" strokeLinecap="round" />
                          <circle cx="10" cy="10.5" r="2.25" />
                        </svg>
                      </span>
                      <span className="pf-track-gold-split__item-text">
                        <strong>{copy.personalOverview.scanInvoice}</strong>
                        <span>{copy.personalOverview.scanInvoiceHint}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="pf-track-gold-split__item"
                      role="menuitem"
                      onClick={() => navigateTrackAction('add')}
                    >
                      <span className="pf-track-gold-split__item-icon" aria-hidden>
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M4 6h12M4 10h8M4 14h10" strokeLinecap="round" />
                          <rect x="3" y="4" width="14" height="12" rx="1.5" />
                        </svg>
                      </span>
                      <span className="pf-track-gold-split__item-text">
                        <strong>{copy.personalOverview.enterManually}</strong>
                        <span>{copy.personalOverview.enterManuallyHint}</span>
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="pf-portfolio-hero__actions-meta">
            {kycVerified ? (
              <span className="bdg bdg-ok pf-portfolio-hero__badge">KYC verified</span>
            ) : (
              <span className="bdg bdg-warn pf-portfolio-hero__badge">KYC pending</span>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onTogglePrivacy}>
              {masked ? 'Show' : 'Hide'} balances
            </button>
          </div>
        </div>

        <div className="pf-hero-trend-wrap pf-hero-history-block">
          <details className="pf-hero-chart-note">
            <summary className="pf-hero-chart-note__toggle t-fa fs11">How this chart works</summary>
            <p className="t-fa fs11 pf-hero-chart-note__body">
              Board-rate snapshots × {fmtGramsMasked(summaryGrams, masked, 3)} g (selected scope). Dashed line: invested metal
              cost. Tint above → unrealised gain; below → unrealised loss. Past holdings changes aren&apos;t stepped in —
              use Charts or Ledger for full history.
            </p>
          </details>
          <PortfolioHistoryValuationChart
            points={portfolioHistoryPoints}
            investedInr={summaryAllocatedCost}
            granularity={portfolioHistoryGranularity}
            rangeKey={portfolioHistoryRange}
            onRangeChange={onPortfolioHistoryRangeChange}
            masked={masked}
            loading={portfolioHistoryLoading}
            holdingsGrams={summaryGrams}
            compact
            ariaLead={
              masked
                ? 'Portfolio valuation versus invested baseline, balances masked.'
                : 'Estimated portfolio value versus invested baseline from board-rate storage.'
            }
          />
        </div>

        <div className="hero-grid">
          <div className="hero-stat">
            <div className="hs-lbl">Invested</div>
            <div className="hs-val tn">₹{fmtInr(summaryAllocatedCost, masked)}</div>
            <div className="hs-hint">Metal value only · excl. GST</div>
            {summaryTotalPaidInr > 0 ? (
              <div className="hs-paid">
                Total paid ₹{fmtInr(summaryTotalPaidInr, masked)}
                <span className="hs-paid__tag"> incl. GST</span>
              </div>
            ) : null}
          </div>
          <div className="hero-stat">
            <div className="hs-lbl">Unrealised P/L</div>
            <div className={`hs-val tn${summaryPnlInr >= 0 ? ' c-ok' : ' c-err'}`}>
              {summaryPnlInr >= 0 ? '+' : '−'}₹{fmtInr(Math.abs(summaryPnlInr), masked)}
              {summaryPnlPct != null && Number.isFinite(summaryPnlPct) ? (
                <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>
                  {' '}
                  ({summaryPnlInr >= 0 ? '+' : ''}
                  {summaryPnlPct.toFixed(2)}%)
                </span>
              ) : null}
            </div>
          </div>
          {isPersonalScope ? (
            <>
              <div className="hero-stat">
                <div className="hs-lbl">Pieces tracked</div>
                <div className="hs-val tn" style={{ color: '#a78bfa' }}>
                  {personalHoldingsCount}
                </div>
              </div>
              <div className="hero-stat">
                <div className="hs-lbl">{copy.holdingsScope.vaultContext}</div>
                <div className="hs-val c-gold tn">{fmtGramsMasked(vaultGramsPortfolio, masked, 3)} g</div>
                <div className="hs-hint">Not in personal scope</div>
              </div>
            </>
          ) : (
            <>
              <div className="hero-stat">
                <div className="hs-lbl">Redeemable</div>
                <div className="hs-val c-gold tn">{fmtGramsMasked(redeemG, masked, 3)} g</div>
              </div>
              <div className="hero-stat">
                <div className="hs-lbl">Locked in loan</div>
                <div className="hs-val c-warn tn">{fmtGramsMasked(lockedLoanG, masked, 3)} g</div>
              </div>
            </>
          )}
        </div>
      </div>

      {showPersonalPreview ? (
        <article className="card card-p pf-personal-preview mb20 pf-portfolio-personal-preview">
          <div className="row-b mb12">
            <div>
              <div className="sec-title">{copy.personalOverview.previewTitle}</div>
              <div className="sec-sub t-fa fs11">{copy.personalOverview.previewLiveHint}</div>
            </div>
            {personalHoldingsCount > 0 ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onViewPersonal}>
                {copy.personalOverview.viewAll}
              </button>
            ) : null}
          </div>
          {personalHoldingsCount === 0 ? (
            <div className="pf-personal-preview__empty">
              <div className="pf-personal-preview__empty-ico" aria-hidden>
                ✨
              </div>
              <p className="pf-personal-preview__empty-lead">{copy.personalOverview.previewEmptyLead}</p>
              <p className="t-fa fs11" style={{ color: 'var(--ink3)', margin: '0 0 16px' }}>
                {dashboardCopy.customer.empty.personalHoldingsHero}
              </p>
              <div className="pf-personal-preview__empty-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onNavigatePersonalAction('scan')}
                >
                  {copy.personalOverview.scanInvoice}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onNavigatePersonalAction('add')}
                >
                  {copy.personalOverview.enterManually}
                </button>
              </div>
            </div>
          ) : (
            <ul className="pf-personal-preview__list">
              {personalPreview.map((h) => (
                <li key={h.id} className="pf-personal-preview__row">
                  <div>
                    <strong className="pf-personal-preview__title">{h.title}</strong>
                    <span className="pf-personal-preview__meta tabular">
                      {h.weight_grams} g · {h.purity}
                    </span>
                  </div>
                  <span className="pf-personal-preview__val tabular">
                    {masked ? '••••' : `₹${parseN(h.estimated_current_value_inr).toLocaleString('en-IN')}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}

      <div className="stat-row stat-row--holdings mb20">
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
        <button
          type="button"
          className="stat e pf-personal-stat-card"
          onClick={onViewPersonal}
          aria-label="View personal gold holdings"
        >
          <div className="stat-lbl">Personal gold</div>
          <div className="stat-val tn" style={{ color: '#a78bfa' }}>
            {fmtGramsMasked(personalGramsPortfolio, masked, 3)}
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink2)' }}> g</span>
          </div>
          <div className="stat-sub">
            {personalHoldingsCount > 0
              ? `${personalHoldingsCount} piece${personalHoldingsCount === 1 ? '' : 's'} · ≈ ₹${fmtInr(personalValueInrPortfolio, masked)}`
              : 'Jewellery you recorded'}
          </div>
          <div className="pf-personal-stat-card__actions">
            <span
              className="pf-personal-stat-card__chip"
              role="presentation"
              onClick={(e) => {
                e.stopPropagation()
                onNavigatePersonalAction('add')
              }}
            >
              {copy.personalOverview.addShort}
            </span>
            <span
              className="pf-personal-stat-card__chip pf-personal-stat-card__chip--muted"
              role="presentation"
              onClick={(e) => {
                e.stopPropagation()
                onNavigatePersonalAction('scan')
              }}
            >
              {copy.personalOverview.scanBill}
            </span>
          </div>
        </button>
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
              <div className="sec-sub t-fa fs11">
                Board-rate track · same window as overview ·{' '}
                <span className="tn">{fmtGramsMasked(summaryGrams, masked, 3)}</span> g scope
              </div>
            </div>
            {summaryPnlPct != null && Number.isFinite(summaryPnlPct) ? (
              <span className={`bdg${summaryPnlPct >= 0 ? ' bdg-ok' : ' bdg-err'}`}>
                {summaryPnlPct >= 0 ? '+' : ''}
                {summaryPnlPct.toFixed(2)}%
              </span>
            ) : (
              <span className="bdg bdg-grey">—</span>
            )}
          </div>
          <PortfolioHistoryValuationChart
            points={portfolioHistoryPoints}
            investedInr={summaryAllocatedCost}
            granularity={portfolioHistoryGranularity}
            rangeKey={portfolioHistoryRange}
            onRangeChange={onPortfolioHistoryRangeChange}
            masked={masked}
            loading={portfolioHistoryLoading}
            holdingsGrams={summaryGrams}
            ariaLead="Portfolio valuation over selected window versus invested metal cost baseline."
          />
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
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, fontSize: '0.72rem', textAlign: 'center' }}
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
            <div>
              <div className="t-fa fw7" style={{ fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Personal
              </div>
              <div className="fw7 tn" style={{ color: '#a78bfa' }}>
                {fmtGramsMasked(personalGramsPortfolio, masked, 2)} g
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
          {recentTxSorted.length === 0 ? (
            <div className="empty" style={{ border: 'none', margin: 16 }}>
              <div className="empty-ico" aria-hidden>
                📜
              </div>
              <h3>No purchases yet</h3>
              <p>Fractional buys and deposits appear here.</p>
            </div>
          ) : (
            <>
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
                  {recentTxRows.map((row, idx) => (
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
              {recentPg.active ? (
                <TablePagination
                  page={recentPg.page}
                  totalPages={recentPg.totalPages}
                  totalItems={recentTxSorted.length}
                  pageSize={recentPg.pageSize}
                  onPrev={() => recentPg.setPage((p) => Math.max(0, p - 1))}
                  onNext={() => recentPg.setPage((p) => Math.min(recentPg.totalPages - 1, p + 1))}
                  className="tbl-inline-pagination"
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      {wallet?.cridora_member_id ? (
        <p className="t-fa fs11 mt16" style={{ marginBottom: 0 }}>
          Member ID <strong className="tn">{wallet.cridora_member_id}</strong>
        </p>
      ) : null}

      {trackMenuOpen && isMobileViewport
        ? createPortal(
            <>
              <button
                type="button"
                className="pf-track-gold-sheet__backdrop"
                aria-label="Close track gold menu"
                onClick={closeTrackMenu}
              />
              <div
                className="pf-track-gold-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pf-track-gold-sheet-title"
              >
                <div className="pf-track-gold-sheet__grab" aria-hidden />
                <p id="pf-track-gold-sheet-title" className="pf-track-gold-sheet__title t-fa">
                  Add personal gold
                </p>
                <button
                  type="button"
                  className="pf-track-gold-sheet__item pf-track-gold-sheet__item--featured"
                  onClick={() => navigateTrackAction('scan')}
                >
                  <span className="pf-track-gold-sheet__item-icon pf-track-gold-sheet__item-icon--scan" aria-hidden>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="5" width="14" height="11" rx="1.5" />
                      <path d="M7 3h6M10 3v2" strokeLinecap="round" />
                      <circle cx="10" cy="10.5" r="2.25" />
                    </svg>
                  </span>
                  <span className="pf-track-gold-sheet__item-text">
                    <strong>{copy.personalOverview.scanInvoice}</strong>
                    <span>{copy.personalOverview.scanInvoiceHint}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="pf-track-gold-sheet__item"
                  onClick={() => navigateTrackAction('add')}
                >
                  <span className="pf-track-gold-sheet__item-icon" aria-hidden>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 6h12M4 10h8M4 14h10" strokeLinecap="round" />
                      <rect x="3" y="4" width="14" height="12" rx="1.5" />
                    </svg>
                  </span>
                  <span className="pf-track-gold-sheet__item-text">
                    <strong>{copy.personalOverview.enterManually}</strong>
                    <span>{copy.personalOverview.enterManuallyHint}</span>
                  </span>
                </button>
                <button type="button" className="pf-track-gold-sheet__cancel btn btn-ghost" onClick={closeTrackMenu}>
                  Cancel
                </button>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  )
}
