import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProductPhoto } from '@/components/ProductPhoto'
import {
  fetchMarketplaceProduct,
  type MarketplaceProductDTO,
} from '@/lib/marketplaceApi'
import { useLivePoll } from '@/lib/useLivePoll'
import { fetchGoldWallet, holdingsJewellerIdsFromWallet, walletBalanceGrams } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import {
  MarketplaceProductPricingBreakdown,
  formatInr,
  formatJewellerMetalRateAsOf,
  hasStoneOrOtherMetal,
} from '@/features/marketplace/productPricing'
import {
  makingChargesShortLabel,
  sameStoreMakingExplainer,
  type CheckoutPricingContext,
} from '@/lib/marketplacePricing'

function Row({
  label,
  value,
  muted,
}: {
  label: string
  value: ReactNode
  muted?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: muted ? 600 : 500 }} className="tabular">
        {value}
      </span>
    </div>
  )
}

export function MarketplaceProductDetailPage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<MarketplaceProductDTO | null>(null)
  const [loadError, setLoadError] = useState('')
  const [pricingContext, setPricingContext] = useState<CheckoutPricingContext | undefined>(undefined)
  const [portfolioVaultGrams, setPortfolioVaultGrams] = useState(0)

  const idNum = productId && /^\d+$/.test(productId) ? Number.parseInt(productId, 10) : NaN

  const load = useCallback(async () => {
    if (!Number.isFinite(idNum)) {
      setLoadError('Invalid product.')
      setProduct(null)
      return
    }
    setLoadError('')
    const p = await fetchMarketplaceProduct(idNum)
    if (!p) {
      setLoadError('This listing is not available.')
      setProduct(null)
      return
    }
    setProduct(p)
  }, [idNum])

  useEffect(() => {
    void load()
  }, [load])

  const refreshWallet = useCallback(async () => {
    const w = await fetchGoldWallet()
    if (!w) {
      setPricingContext(undefined)
      setPortfolioVaultGrams(0)
      return
    }
    setPricingContext({
      customerDefaultJewellerId: w.default_jeweller_id,
      holdingsJewellerIds: holdingsJewellerIdsFromWallet(w),
    })
    setPortfolioVaultGrams(walletBalanceGrams(w))
  }, [])

  useEffect(() => {
    void refreshWallet()
  }, [refreshWallet])

  useLivePoll(refreshWallet, LIVE_BALANCE_POLL_MS, true)

  const goCheckout = () => {
    if (!product) return
    navigate(`/marketplace?checkout=${product.id}`)
  }

  if (loadError || !product) {
    return (
      <div className="container page" style={{ paddingBottom: '4rem' }}>
        <Link to="/marketplace" className="btn btn-ghost" style={{ marginBottom: '1rem', display: 'inline-block' }}>
          ← Back to marketplace
        </Link>
        <p className="form-error">{loadError || 'Loading…'}</p>
      </div>
    )
  }

  const stoneCompVal = Number.parseFloat(product.stone_component_inr)
  const showStone = hasStoneOrOtherMetal(product)
  const jewellerRateAsOf = formatJewellerMetalRateAsOf(product.jeweller_metal_rate_last_updated_at)
  const sameStoreLine = sameStoreMakingExplainer(product)

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <div className="container page" style={{ paddingTop: '1.25rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/marketplace" className="btn btn-ghost">
            ← Back to marketplace
          </Link>
        </div>

        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            borderRadius: 24,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: 0,
          }}
        >
          <div style={{ background: 'var(--gradient-modal-aside)', padding: '1.5rem' }}>
            <div className="media-frame" style={{ borderRadius: 18, aspectRatio: '1', maxHeight: 420 }}>
              <ProductPhoto src={product.image_url} alt={product.name} />
            </div>
          </div>
          <div style={{ padding: '1.5rem 1.5rem 1.75rem', background: 'var(--veil-35)' }}>
            <p
              style={{
                margin: '0 0 0.35rem',
                fontSize: '0.62rem',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--gold-light)',
              }}
            >
              {product.jeweller_name}
              {product.jeweller_city ? ` · ${product.jeweller_city}` : ''}
            </p>
            <h1 className="h1-page" style={{ margin: '0 0 0.5rem', fontSize: 'clamp(1.35rem, 3vw, 1.85rem)' }}>
              {product.name}
            </h1>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {product.category ? `${product.category} · ` : ''}
              {product.gold_weight_grams} g · {(product.metal_purity_label ?? '').trim() || 'Hallmark'} · Making{' '}
              {makingChargesShortLabel(product)}
              {product.stock_quantity != null ? ` · Stock ${product.stock_quantity}` : ''}
            </p>
            {showStone ? (
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text)' }}>Stone / other:</strong>{' '}
                {product.stone_included ? product.stone_type || 'Included' : 'Component in quote'}
                {(product.stone_weight_grams ?? '').toString().trim() !== '' ? ` · ${product.stone_weight_grams} g` : ''}
                {(product.stone_cost_inr ?? '').toString().trim() !== ''
                  ? ` · ₹${product.stone_cost_inr}`
                  : stoneCompVal > 0
                    ? ` · ₹${formatInr(stoneCompVal)}`
                    : ''}
              </p>
            ) : null}

            {sameStoreLine ? (
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text)' }}>Same-shop making:</strong> {sameStoreLine}
              </p>
            ) : (product.same_store_benefit_note ?? '').trim() ? (
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text)' }}>Jeweller note:</strong> {product.same_store_benefit_note}
              </p>
            ) : null}

            <h2 style={{ margin: '0 0 0.65rem', fontSize: '1.05rem' }}>Rates, taxes &amp; vault estimate</h2>
            <p style={{ margin: '0 0 0.85rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Metal ₹/g is this jeweller&apos;s live listing rate (their manual rate or live market benchmark plus their markups — customers only see this showroom rate).
              {jewellerRateAsOf ? (
                <>
                  {' '}
                  Rate last updated <strong>{jewellerRateAsOf}</strong>.
                </>
              ) : null}
            </p>

            <MarketplaceProductPricingBreakdown
              p={product}
              pricingContext={pricingContext}
              portfolioVaultGrams={portfolioVaultGrams}
            />

            <div
              style={{
                marginTop: '1rem',
                padding: '0.85rem',
                borderRadius: 14,
                border: '1px solid var(--border-soft)',
                background: 'var(--veil-35)',
                fontSize: '0.8rem',
              }}
            >
              <Row
                label="Indicative sellback"
                value={`₹${formatInr(Number.parseFloat(product.sellback_indicative_inr_per_gram), 2)}/g`}
                muted
              />
              <Row
                label="Sellback deduction"
                value={`${product.sellback_deduction_percent}% + ₹${product.sellback_fixed_inr_per_gram}/g`}
                muted
              />
              {product.gold_deposit_note ? (
                <p style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)', lineHeight: 1.45 }}>{product.gold_deposit_note}</p>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginTop: '1.35rem' }}>
              <button type="button" className="btn btn-primary" onClick={goCheckout}>
                Buy now
              </button>
              <Link to={`/jewellers/${product.jeweller_id}`} className="btn btn-ghost">
                View jeweller
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
