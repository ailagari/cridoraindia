import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserAvatar } from '@/components/UserAvatar'
import { mergeJewellerListWithDemos } from '@/lib/jewellerMarketplaceDemos'
import { jewellerStorefrontFeatureChips } from '@/features/marketplace/jewellerMarketplaceShared'
import { LIVE_STOREFRONT_GRID_POLL_MS } from '@/lib/liveDeskIntervals'
import { fetchVerifiedJewellers, type JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import { useLiveCridoraBase } from '@/hooks/useLiveCridoraBase'
import {
  canPromoteJewellerToPrimary,
  fetchGoldWallet,
  patchDefaultJeweller,
  type GoldWalletDTO,
} from '@/lib/goldTransferApi'

function formatInr(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

function parseNum(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export type JewellerSortKey =
  | 'name'
  | 'making'
  | 'buyback'
  | 'deposit'
  | 'loan'
  | 'listings'

const SORT_OPTIONS: { value: JewellerSortKey; label: string }[] = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'making', label: 'Making charge (low → high)' },
  { value: 'buyback', label: 'Sellback rate (high → low)' },
  { value: 'deposit', label: 'Gold deposit yield (high → low)' },
  { value: 'loan', label: 'Max loan % (high → low)' },
  { value: 'listings', label: 'Most listings' },
]

function JewellerCardLogo({ businessName, logoUrl }: { businessName: string; logoUrl: string }) {
  const fallback = businessName.trim().charAt(0).toUpperCase() || '—'
  return (
    <UserAvatar
      imageUrl={logoUrl}
      fallback={fallback}
      imageFit="contain"
      className="jm-card__logo"
    />
  )
}

function dashEmpty(s: string): string {
  const t = s.trim()
  return t === '' ? '—' : t
}

type CardProps = {
  j: JewellerStorefrontDTO
  variant: 'public' | 'customer_dashboard'
  wallet?: GoldWalletDTO | null
  defaultBusyId?: number | null
  onSetDefault?: (jewellerId: number) => void
}

function JewellerMarketplaceCard({ j, variant, wallet, defaultBusyId, onSetDefault }: CardProps) {
  const tags = jewellerStorefrontFeatureChips(j)
  const cred =
    j.credibility_score && j.credibility_score.trim() !== '' ? `${j.credibility_score}/100` : null
  const years =
    j.metric_years_active && parseNum(j.metric_years_active) > 0 ? `${j.metric_years_active} yr` : null

  const isPrimary = variant === 'customer_dashboard' && wallet?.default_jeweller_id === j.id
  const isSecondary =
    variant === 'customer_dashboard' && (wallet?.secondary_jeweller_ids ?? []).includes(j.id)
  const setDefaultGate =
    variant === 'customer_dashboard' && j.id > 0 && wallet
      ? canPromoteJewellerToPrimary(wallet, j.id)
      : { allowed: false as const }

  return (
    <article className="jm-card card">
      <header className="jm-card__hero">
        <div className="jm-card__identity">
          <JewellerCardLogo businessName={j.business_name} logoUrl={j.logo_url ?? ''} />
          <div className="jm-card__head">
            <div className="jm-card__title-row">
              <h2 className="jm-card__title">{j.business_name}</h2>
            </div>
            <p className="jm-card__location">
              {j.city}
              {j.state ? `, ${j.state}` : ''}
            </p>
            <div className="jm-card__badges">
              <span
                className="kyb-pill kyb-pill--ok"
                style={{ fontSize: '0.58rem', padding: '0.15rem 0.45rem' }}
                title={j.id > 0 ? 'KYB verified' : 'Demo preview'}
              >
                Verified
              </span>
              {isPrimary ? (
                <span
                  className="kyb-pill kyb-pill--ok"
                  style={{ fontSize: '0.58rem', padding: '0.15rem 0.45rem', background: 'var(--gold-bg)' }}
                >
                  Primary
                </span>
              ) : null}
              {isSecondary ? (
                <span className="jm-card__cred" title="You hold a vault with this jeweller">
                  Secondary
                </span>
              ) : null}
              {cred ? <span className="jm-card__cred">Trust {cred}</span> : null}
            </div>
          </div>
        </div>
      </header>

      <div className="jm-card__body">
        <section>
          <p className="jm-card__section-label">Live rates</p>
          <div className="jm-card__rates">
            <div className="jm-card__rate">
              <p className="jm-card__rate-label">22K reference</p>
              <p className="jm-card__rate-value tabular">
                ₹{formatInr(parseNum(j.reference_metal_inr_per_gram), 2)}/g
              </p>
            </div>
            <div className="jm-card__rate jm-card__rate--highlight">
              <p className="jm-card__rate-label">Buyback</p>
              <p className="jm-card__rate-value jm-card__rate-value--gold tabular">
                ₹{formatInr(parseNum(j.buyback_indicative_inr_per_gram), 2)}/g
              </p>
            </div>
          </div>
        </section>

        <section>
          <p className="jm-card__section-label">Redemption</p>
          <div className="jm-card__redemption">
            <div>
              <strong>Lock-in:</strong> {dashEmpty(j.lock_in_summary ?? '')}
            </div>
            <div>
              <strong>Min redeem:</strong>{' '}
              {j.minimum_redeemable_grams && j.minimum_redeemable_grams.trim() !== ''
                ? `${j.minimum_redeemable_grams} g`
                : '—'}
            </div>
            <div>
              <strong>Same-store MC:</strong> {dashEmpty(j.same_store_mc_benefit ?? '')}
            </div>
            {j.golden_scheme_enabled && (j.golden_scheme_summary ?? '').trim() !== '' ? (
              <div>
                <strong>Golden scheme:</strong> {j.golden_scheme_summary}
              </div>
            ) : null}
          </div>
        </section>

        {tags.length > 0 ? (
          <div className="jm-card__chips">
            {tags.map((t) => (
              <span key={t.key} className="jm-card__chip jm-card__chip--on">
                {t.label}
              </span>
            ))}
          </div>
        ) : null}

        <p className="jm-card__meta">
          {years ? (
            <span className="jm-card__meta-stat">
              <span>Active</span>
              <strong className="tabular">{years}</strong>
            </span>
          ) : null}
          <span className="jm-card__meta-stat">
            <span>Listings</span>
            <strong className="tabular">{j.approved_listing_count}</strong>
          </span>
          <span className="jm-card__meta-stat">
            <span>Making typ.</span>
            <strong className="tabular">
              ₹{formatInr(parseNum(j.representative_making_charge_inr_per_gram), 0)}/g
            </strong>
          </span>
          {j.buyback_uses_headline_override ? <span>· headline sellback</span> : null}
          {j.id <= 0 ? <span>· demo</span> : null}
        </p>

        <footer className="jm-card__footer">
          <div className="jm-card__actions">
            {j.id > 0 ? (
              <Link to={`/jewellers/${j.id}`} className="btn btn-ghost">
                View shop
              </Link>
            ) : (
              <span
                className="btn btn-ghost"
                style={{ opacity: 0.55, cursor: 'default', pointerEvents: 'none' }}
                title="Live when this jeweller is on the API"
              >
                View shop
              </span>
            )}
            <Link
              to={
                j.id > 0
                  ? variant === 'customer_dashboard'
                    ? `/userdashboard?section=invest_fractional&jeweller_id=${j.id}`
                    : `/signup?jeweller=${j.id}`
                  : '/signup'
              }
              className="btn btn-primary"
            >
              {variant === 'customer_dashboard' ? 'Buy gold' : 'Invest'}
            </Link>
            {variant === 'customer_dashboard' && j.id > 0 ? (
              <Link
                to={`/userdashboard?section=invest_scheme&jeweller_id=${j.id}`}
                className="btn btn-ghost"
              >
                Join scheme
              </Link>
            ) : null}
            {variant === 'customer_dashboard' && j.id > 0 && onSetDefault ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!setDefaultGate.allowed || defaultBusyId != null}
                title={
                  isPrimary
                    ? 'Already your primary jeweller'
                    : setDefaultGate.reason ?? 'Set as your primary default jeweller'
                }
                onClick={() => onSetDefault(j.id)}
              >
                {defaultBusyId === j.id ? 'Saving…' : isPrimary ? 'Primary' : 'Set as primary'}
              </button>
            ) : variant === 'public' ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled
                style={{ opacity: 0.55 }}
                title="Sign up and choose a primary jeweller from your dashboard"
              >
                Set default
              </button>
            ) : null}
            <Link
              to={
                j.id > 0
                  ? variant === 'customer_dashboard'
                    ? `/userdashboard?section=shop_products&jeweller=${j.id}`
                    : `/marketplace?jeweller=${j.id}`
                  : variant === 'customer_dashboard'
                    ? '/userdashboard?section=shop_products'
                    : '/marketplace'
              }
              className="jm-card__browse"
            >
              Catalogue →
            </Link>
          </div>
        </footer>
      </div>
    </article>
  )
}

type Props = {
  intro?: string
  /** Customer dashboard: CTAs open fractional buy / catalogue inside `/userdashboard`. */
  variant?: 'public' | 'customer_dashboard'
  /** Optional wallet snapshot from parent (avoids duplicate fetch). */
  wallet?: GoldWalletDTO | null
  onWalletChange?: (wallet: GoldWalletDTO) => void
}

export function JewellerMarketplaceGrid({ intro, variant = 'public', wallet: walletProp, onWalletChange }: Props) {
  const [rows, setRows] = useState<JewellerStorefrontDTO[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('All Cities')
  const [sortBy, setSortBy] = useState<JewellerSortKey>('name')
  const [walletLocal, setWalletLocal] = useState<GoldWalletDTO | null>(null)
  const [defaultBusyId, setDefaultBusyId] = useState<number | null>(null)
  const [setDefaultMsg, setSetDefaultMsg] = useState('')
  const [setDefaultErr, setSetDefaultErr] = useState('')

  const wallet = variant === 'customer_dashboard' ? (walletProp ?? walletLocal) : null

  const { data: liveBase } = useLiveCridoraBase()

  const refresh = useCallback(async () => {
    const data = await fetchVerifiedJewellers()
    setRows(mergeJewellerListWithDemos(data))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (variant !== 'customer_dashboard' || walletProp != null) return
    void fetchGoldWallet().then((w) => {
      if (w) setWalletLocal(w)
    })
  }, [variant, walletProp])

  useEffect(() => {
    if (walletProp != null) setWalletLocal(walletProp)
  }, [walletProp])

  const onSetDefault = useCallback(
    async (jewellerId: number) => {
      setSetDefaultMsg('')
      setSetDefaultErr('')
      const gate = canPromoteJewellerToPrimary(wallet, jewellerId)
      if (!gate.allowed) {
        setSetDefaultErr(gate.reason ?? 'Cannot set primary jeweller.')
        return
      }
      setDefaultBusyId(jewellerId)
      try {
        const out = await patchDefaultJeweller(jewellerId)
        if (!out.ok) {
          setSetDefaultErr(out.detail)
          return
        }
        setWalletLocal(out.wallet)
        onWalletChange?.(out.wallet)
        setSetDefaultMsg('Primary jeweller updated.')
      } finally {
        setDefaultBusyId(null)
      }
    },
    [onWalletChange, wallet],
  )

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh()
    }, LIVE_STOREFRONT_GRID_POLL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  const cities = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.city) set.add(r.city)
    }
    return ['All Cities', ...Array.from(set).sort()]
  }, [rows])

  const filteredSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let list = rows
    if (selectedCity !== 'All Cities') {
      list = list.filter((j) => j.city === selectedCity)
    }
    list = list.filter((j) => {
      if (!q) return true
      return (
        j.business_name.toLowerCase().includes(q) ||
        j.city.toLowerCase().includes(q) ||
        j.state.toLowerCase().includes(q) ||
        j.shop_address.toLowerCase().includes(q)
      )
    })
    const out = [...list]
    const cmpStr = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' })
    if (sortBy === 'name') {
      out.sort((a, b) => cmpStr(a.business_name, b.business_name))
    } else if (sortBy === 'making') {
      out.sort(
        (a, b) =>
          parseNum(a.representative_making_charge_inr_per_gram) -
          parseNum(b.representative_making_charge_inr_per_gram),
      )
    } else if (sortBy === 'buyback') {
      out.sort(
        (a, b) => parseNum(b.buyback_indicative_inr_per_gram) - parseNum(a.buyback_indicative_inr_per_gram),
      )
    } else if (sortBy === 'deposit') {
      out.sort(
        (a, b) => parseNum(b.gold_deposit_yield_apr_percent) - parseNum(a.gold_deposit_yield_apr_percent),
      )
    } else if (sortBy === 'loan') {
      out.sort(
        (a, b) => parseNum(b.gold_loan_ltv_percent ?? '0') - parseNum(a.gold_loan_ltv_percent ?? '0'),
      )
    } else if (sortBy === 'listings') {
      out.sort((a, b) => b.approved_listing_count - a.approved_listing_count)
    }
    return out
  }, [rows, searchQuery, sortBy, selectedCity])

  return (
    <>
      {intro ? (
        <p style={{ color: 'var(--text-muted)', maxWidth: '42rem', margin: '0 0 1.25rem', fontSize: '0.95rem' }}>
          {intro}
        </p>
      ) : null}

      <div className="jm-live-strip card">
        <span className="jm-live-strip__label">Cridora 22K (live)</span>
        <span className="tabular">
          ₹{liveBase?.platformBaseInrPerGram22k ? formatInr(parseNum(liveBase.platformBaseInrPerGram22k), 2) : '—'}/g
        </span>
        <span style={{ color: 'var(--text-faint)' }}>
          {liveBase?.source ? liveBase.source.replace(/_/g, ' ') : ''}
        </span>
        <span style={{ color: 'var(--text-faint)', marginLeft: 'auto' }}>Directory refreshes every minute</span>
      </div>

      <div className="jm-filters card">
        <div className="jm-filters__grid">
          <div className="jm-filters__search">
            <span className="jm-filters__icon">⌕</span>
            <input
              type="search"
              className="jm-filters__input"
              placeholder="Search jeweller, city, or area…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <span className="jm-filters__icon" style={{ left: 10, fontSize: '0.7rem' }}>
              ◎
            </span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="jm-filters__input"
              style={{ paddingLeft: '2rem', cursor: 'pointer' }}
            >
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div style={{ position: 'relative' }}>
            <span className="jm-filters__icon" style={{ left: 10, fontSize: '0.7rem' }}>
              ☰
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as JewellerSortKey)}
              className="jm-filters__input"
              style={{ paddingLeft: '2rem', cursor: 'pointer' }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ borderRadius: 16, minHeight: 48 }}
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Showing <strong style={{ color: 'var(--text)' }}>{filteredSorted.length}</strong> partners
          {selectedCity !== 'All Cities' ? ` · ${selectedCity}` : ''}
        </p>
        {setDefaultMsg ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--success)' }}>{setDefaultMsg}</p>
        ) : null}
        {setDefaultErr ? (
          <p className="form-error" style={{ margin: 0 }}>
            {setDefaultErr}
          </p>
        ) : null}
      </div>

      {filteredSorted.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No jewellers match this filter. Try another city or clear search.
        </p>
      ) : (
        <div className="jm-grid">
          {filteredSorted.map((j) => (
            <JewellerMarketplaceCard
              key={j.id <= 0 ? `demo-${j.business_name}` : j.id}
              j={j}
              variant={variant}
              wallet={wallet}
              defaultBusyId={defaultBusyId}
              onSetDefault={variant === 'customer_dashboard' ? (id) => void onSetDefault(id) : undefined}
            />
          ))}
        </div>
      )}
    </>
  )
}
