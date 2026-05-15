import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { mergeJewellerListWithDemos } from '@/lib/jewellerMarketplaceDemos'
import { LIVE_STOREFRONT_GRID_POLL_MS } from '@/lib/liveDeskIntervals'
import { fetchVerifiedJewellers, type JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import { useLiveCridoraBase } from '@/hooks/useLiveCridoraBase'

const filterBarInput: CSSProperties = {
  width: '100%',
  padding: '0.9rem 0.9rem 0.9rem 2.5rem',
  borderRadius: 16,
  border: '1px solid var(--border-soft)',
  background: 'var(--veil)',
  color: 'var(--text)',
  fontSize: '0.85rem',
  fontFamily: 'var(--font)',
}

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
  { value: 'loan', label: 'Gold loan indicator (low → high)' },
  { value: 'listings', label: 'Most listings' },
]

function JewellerCardLogo({ businessName, logoUrl }: { businessName: string; logoUrl: string }) {
  const [broken, setBroken] = useState(false)
  const showImg = logoUrl.trim() !== '' && !broken
  if (showImg) {
    return (
      <div className="media-frame media-frame--logo-tile">
        <img src={logoUrl} alt="" className="media-fill" onError={() => setBroken(true)} />
      </div>
    )
  }
  const ch = businessName.trim().charAt(0).toUpperCase() || '—'
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        display: 'grid',
        placeItems: 'center',
        fontWeight: 800,
        fontSize: '1.1rem',
        background: 'var(--gold-soft)',
        color: 'var(--gold-light)',
        border: '1px solid rgba(180, 130, 48, 0.35)',
      }}
      aria-hidden
    >
      {ch}
    </div>
  )
}

function featureChips(j: JewellerStorefrontDTO): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  if (j.feat_instant_redemption) out.push({ key: 'instant', label: 'Instant redemption' })
  if (j.feat_zero_mc_same_store) out.push({ key: '0mc', label: '0% MC' })
  if (j.feat_loan_available) out.push({ key: 'loan', label: 'Loan' })
  if (j.feat_goldnest_available) out.push({ key: 'goldnest', label: 'GoldNest' })
  if (j.feat_emergency_funds) out.push({ key: 'em', label: 'Emergency funds' })
  return out
}

function dashEmpty(s: string): string {
  const t = s.trim()
  return t === '' ? '—' : t
}

type Props = {
  intro?: string
  /** Customer dashboard: CTAs open fractional buy / catalogue inside `/userdashboard`. */
  variant?: 'public' | 'customer_dashboard'
}

export function JewellerMarketplaceGrid({ intro, variant = 'public' }: Props) {
  const [rows, setRows] = useState<JewellerStorefrontDTO[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('All Cities')
  const [sortBy, setSortBy] = useState<JewellerSortKey>('name')

  const { data: liveBase } = useLiveCridoraBase()

  const refresh = useCallback(async () => {
    const data = await fetchVerifiedJewellers()
    setRows(mergeJewellerListWithDemos(data))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

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
        (a, b) => parseNum(a.gold_loan_interest_apr_percent) - parseNum(b.gold_loan_interest_apr_percent),
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

      <div
        className="card"
        style={{
          marginBottom: '1rem',
          padding: '0.65rem 1rem',
          borderRadius: 16,
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem 1.25rem',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--gold-light)' }}>Cridora 22K (live)</span>
        <span className="tabular">
          ₹{liveBase?.platformBaseInrPerGram22k ? formatInr(parseNum(liveBase.platformBaseInrPerGram22k), 2) : '—'}/g
        </span>
        <span style={{ color: 'var(--text-faint)' }}>
          {liveBase?.source ? liveBase.source.replace(/_/g, ' ') : ''}
        </span>
        <span style={{ color: 'var(--text-faint)', marginLeft: 'auto' }}>Directory refreshes every minute</span>
      </div>

      <div
        className="card"
        style={{
          padding: '1.25rem',
          borderRadius: 24,
          boxShadow: 'var(--shadow-card)',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.75rem',
            alignItems: 'stretch',
          }}
        >
          <div style={{ position: 'relative', gridColumn: 'span 2 / auto' }}>
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-faint)',
                fontSize: '0.75rem',
                pointerEvents: 'none',
              }}
            >
              ⌕
            </span>
            <input
              type="search"
              placeholder="Search jeweller, city, or area…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...filterBarInput, paddingLeft: '2.25rem' }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-faint)',
                fontSize: '0.7rem',
                pointerEvents: 'none',
              }}
            >
              ◎
            </span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              style={{ ...filterBarInput, paddingLeft: '2rem', cursor: 'pointer' }}
            >
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-faint)',
                fontSize: '0.7rem',
                pointerEvents: 'none',
              }}
            >
              ☰
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as JewellerSortKey)}
              style={{ ...filterBarInput, paddingLeft: '2rem', cursor: 'pointer' }}
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
      </div>

      {filteredSorted.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No jewellers match this filter. Try another city or clear search.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredSorted.map((j) => {
            const tags = featureChips(j)
            const cred =
              j.credibility_score && j.credibility_score.trim() !== ''
                ? `${j.credibility_score}/100`
                : null
            return (
              <article
                key={j.id <= 0 ? `demo-${j.business_name}` : j.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  borderRadius: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <JewellerCardLogo businessName={j.business_name} logoUrl={j.logo_url ?? ''} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.25 }}>{j.business_name}</h2>
                      <span
                        className="kyb-pill kyb-pill--ok"
                        style={{ fontSize: '0.58rem', padding: '0.15rem 0.4rem' }}
                        title={j.id > 0 ? 'KYB verified' : 'Demo preview'}
                      >
                        Verified
                      </span>
                      {cred ? (
                        <span style={{ fontSize: '0.72rem', color: 'var(--gold-light)', fontWeight: 700 }}>
                          Score {cred}
                        </span>
                      ) : null}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                      {j.city}
                      {j.state ? `, ${j.state}` : ''}
                    </p>
                  </div>
                </div>

                <div>
                  <p
                    style={{
                      margin: '0 0 0.35rem',
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--text-faint)',
                    }}
                  >
                    Gold
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.45rem',
                      fontSize: '0.72rem',
                    }}
                  >
                    <div className="card" style={{ margin: 0, padding: '0.5rem', borderRadius: 12 }}>
                      <p style={{ margin: 0, fontSize: '0.55rem', color: 'var(--text-faint)', fontWeight: 700 }}>
                        Jeweller live rate
                      </p>
                      <p style={{ margin: '0.2rem 0 0', fontWeight: 800 }} className="tabular">
                        ₹{formatInr(parseNum(j.reference_metal_inr_per_gram), 2)}/g
                      </p>
                    </div>
                    <div className="card" style={{ margin: 0, padding: '0.5rem', borderRadius: 12 }}>
                      <p style={{ margin: 0, fontSize: '0.55rem', color: 'var(--text-faint)', fontWeight: 700 }}>
                        Jeweller live buyback
                      </p>
                      <p
                        style={{ margin: '0.2rem 0 0', fontWeight: 800, color: 'var(--gold-light)' }}
                        className="tabular"
                      >
                        ₹{formatInr(parseNum(j.buyback_indicative_inr_per_gram), 2)}/g
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p
                    style={{
                      margin: '0 0 0.35rem',
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--text-faint)',
                    }}
                  >
                    Redemption
                  </p>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      display: 'grid',
                      gap: '0.35rem',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--text)' }}>Lock-in:</strong> {dashEmpty(j.lock_in_summary ?? '')}
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text)' }}>Min redeem:</strong>{' '}
                      {j.minimum_redeemable_grams && j.minimum_redeemable_grams.trim() !== ''
                        ? `${j.minimum_redeemable_grams} g`
                        : '—'}
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text)' }}>Same-store MC:</strong>{' '}
                      {dashEmpty(j.same_store_mc_benefit ?? '')}
                    </div>
                    {j.golden_scheme_enabled && (j.golden_scheme_summary ?? '').trim() !== '' ? (
                      <div>
                        <strong style={{ color: 'var(--text)' }}>Golden Scheme:</strong> {j.golden_scheme_summary}
                      </div>
                    ) : null}
                  </div>
                </div>

                {tags.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {tags.map((t) => (
                      <span
                        key={t.key}
                        style={{
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.45rem',
                          borderRadius: 8,
                          background: 'var(--veil-35)',
                          border: '1px solid var(--border-soft)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {t.label}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: '0.45rem',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div className="card" style={{ margin: 0, padding: '0.45rem', borderRadius: 10 }}>
                    <p style={{ margin: 0, fontSize: '0.55rem', color: 'var(--text-faint)' }}>Years</p>
                    <p style={{ margin: '0.2rem 0 0', fontWeight: 800, color: 'var(--text)' }} className="tabular">
                      {j.metric_years_active && parseNum(j.metric_years_active) > 0
                        ? `${j.metric_years_active} yr`
                        : '—'}
                    </p>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-faint)' }}>
                  {j.approved_listing_count} listing{j.approved_listing_count === 1 ? '' : 's'}
                  {j.buyback_uses_headline_override ? ' · headline sellback' : ''}
                  {j.id <= 0 ? ' · demo' : ''} · Making typ. ₹
                  {formatInr(parseNum(j.representative_making_charge_inr_per_gram), 0)}/g
                </p>

                <div
                  style={{
                    marginTop: 'auto',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.45rem',
                    alignItems: 'center',
                  }}
                >
                  {j.id > 0 ? (
                    <Link
                      to={`/jewellers/${j.id}`}
                      className="btn btn-ghost"
                      style={{ padding: '0.4rem 0.65rem', borderRadius: 12, fontSize: '0.7rem' }}
                    >
                      View shop
                    </Link>
                  ) : (
                    <span
                      className="btn btn-ghost"
                      style={{
                        padding: '0.4rem 0.65rem',
                        borderRadius: 12,
                        fontSize: '0.7rem',
                        opacity: 0.55,
                        cursor: 'default',
                        pointerEvents: 'none',
                      }}
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
                    style={{ padding: '0.4rem 0.65rem', borderRadius: 12, fontSize: '0.7rem' }}
                  >
                    {variant === 'customer_dashboard' ? 'Buy gold' : 'Invest'}
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled
                    style={{ padding: '0.4rem 0.65rem', borderRadius: 12, fontSize: '0.7rem', opacity: 0.55 }}
                    title="Set default jeweller (coming soon)"
                  >
                    Set default
                  </button>
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
                    style={{ fontSize: '0.72rem', color: 'var(--gold-light)', marginLeft: 4 }}
                  >
                    Browse products →
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
