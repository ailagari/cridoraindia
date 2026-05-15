import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ProductPhoto } from '@/components/ProductPhoto'
import {
  fetchMarketplaceProducts,
  fetchVerifiedJewellers,
  type JewellerStorefrontDTO,
  type MarketplaceProductDTO,
} from '@/lib/marketplaceApi'
import { mergeProductCatalogWithDemos } from '@/lib/productMarketplaceDemos'
import { LIVE_CATALOG_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { MarketplaceProductListSummary } from '@/features/marketplace/productPricing'

const filterBarInput: CSSProperties = {
  width: '100%',
  padding: '0.85rem 0.85rem 0.85rem 2.25rem',
  borderRadius: 16,
  border: '1px solid var(--border-soft)',
  background: 'var(--veil)',
  color: 'var(--text)',
  fontSize: '0.85rem',
  fontFamily: 'var(--font)',
}

export function CustomerProductsBrowsePanel() {
  const [params, setParams] = useSearchParams()
  const jewellerParam = params.get('jeweller')
  const jewellerFilterId = useMemo(() => {
    if (!jewellerParam) return undefined
    const id = Number.parseInt(jewellerParam, 10)
    return Number.isFinite(id) && id > 0 ? id : undefined
  }, [jewellerParam])

  const [catalog, setCatalog] = useState<MarketplaceProductDTO[]>([])
  const [jewellerOptions, setJewellerOptions] = useState<JewellerStorefrontDTO[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loadError, setLoadError] = useState('')

  const refreshCatalog = useCallback(async () => {
    setLoadError('')
    const raw = await fetchMarketplaceProducts(
      jewellerFilterId != null ? { jewellerId: jewellerFilterId } : undefined,
    )
    setCatalog(mergeProductCatalogWithDemos(raw))
  }, [jewellerFilterId])

  const refreshJewellerOptions = useCallback(async () => {
    const rows = await fetchVerifiedJewellers()
    setJewellerOptions(rows.filter((j) => j.id > 0))
  }, [])

  useEffect(() => {
    void refreshCatalog()
  }, [refreshCatalog])

  useEffect(() => {
    void refreshJewellerOptions()
  }, [refreshJewellerOptions])

  useLivePoll(refreshCatalog, LIVE_CATALOG_POLL_MS, true)

  const setJewellerFilter = useCallback(
    (id: number | undefined) => {
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          if (id == null || !Number.isFinite(id)) {
            n.delete('jeweller')
          } else {
            n.set('jeweller', String(id))
          }
          return n
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return catalog.filter((p) => {
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.jeweller_name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
    })
  }, [catalog, searchQuery])

  const jewellerLabel =
    jewellerFilterId != null ? jewellerOptions.find((j) => j.id === jewellerFilterId)?.business_name : null

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Admin-approved listings from verified jewellers (same catalogue as the public marketplace). Open a piece for full
        pricing and imagery, or start a counter fractional purchase with that jeweller from your dashboard.
      </p>

      <div
        className="card"
        style={{
          padding: '1.25rem',
          borderRadius: 24,
          boxShadow: 'var(--shadow-card)',
          marginBottom: '1.25rem',
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
              placeholder="Search collection or jeweller…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...filterBarInput, paddingLeft: '2.25rem' }}
            />
          </div>
          <select
            aria-label="Filter by jeweller"
            value={jewellerFilterId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setJewellerFilter(v === '' ? undefined : Number.parseInt(v, 10))
            }}
            style={{ ...filterBarInput, cursor: 'pointer' }}
          >
            <option value="">All jewellers</option>
            {jewellerOptions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.business_name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost" style={{ borderRadius: 16, minHeight: 48 }} onClick={() => void refreshCatalog()}>
            Refresh
          </button>
        </div>
      </div>

      {loadError ? <p className="form-error">{loadError}</p> : null}

      {jewellerFilterId != null ? (
        <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Filtering {jewellerLabel ? <strong>{jewellerLabel}</strong> : `jeweller #${jewellerFilterId}`}.{' '}
          <button type="button" className="btn btn-ghost" style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setJewellerFilter(undefined)}>
            Clear filter
          </button>
        </p>
      ) : null}

      <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Showing <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> listing{filtered.length === 1 ? '' : 's'}
        .{' '}
        <Link to="/marketplace" style={{ color: 'var(--gold-light)' }}>
          Open full marketplace layout
        </Link>
      </p>

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No products match this filter.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1rem',
          }}
        >
          {filtered.map((p) => (
            <article
              key={p.id}
              className="card"
              style={{
                padding: '1rem',
                borderRadius: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div className="media-frame media-frame--product-card" style={{ borderRadius: 14, overflow: 'hidden' }}>
                <ProductPhoto src={p.image_url} alt="" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', lineHeight: 1.3 }}>{p.name}</h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.jeweller_name}</p>
                <div style={{ marginTop: '0.65rem' }}>
                  <MarketplaceProductListSummary p={p} />
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: 'auto' }}>
                <Link
                  className="btn btn-ghost"
                  style={{ padding: '0.45rem 0.65rem', borderRadius: 12, fontSize: '0.72rem' }}
                  to={`/marketplace/product/${p.id}`}
                >
                  Details
                </Link>
                {p.jeweller_id > 0 ? (
                  <Link
                    className="btn btn-primary"
                    style={{ padding: '0.45rem 0.65rem', borderRadius: 12, fontSize: '0.72rem' }}
                    to={`/userdashboard?section=invest_fractional&jeweller_id=${p.jeweller_id}`}
                  >
                    Buy fractional gold
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
