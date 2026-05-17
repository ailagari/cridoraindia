import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ProductPhoto } from '@/components/ProductPhoto'
import {
  fetchMarketplaceProducts,
  fetchMarketplaceProduct,
  fetchVerifiedJewellers,
  type MarketplaceProductDTO,
  type JewellerStorefrontDTO,
} from '@/lib/marketplaceApi'
import { useLivePoll } from '@/lib/useLivePoll'
import {
  calculateCheckoutPrice,
  makingChargesShortLabel,
  vaultGramsAtListingRateForOrderInr,
  type CheckoutPricingContext,
  type PriceBreakdown,
} from '@/lib/marketplacePricing'
import { fetchGoldWallet, holdingsJewellerIdsFromWallet, vaultCheckoutEligibleGramsAtJeweller, walletBalanceGrams, type GoldWalletDTO } from '@/lib/goldTransferApi'
import { mergeJewellerListWithDemos } from '@/lib/jewellerMarketplaceDemos'
import { LIVE_BALANCE_POLL_MS, LIVE_CATALOG_POLL_MS, LIVE_DIRECTORY_POLL_MS } from '@/lib/liveDeskIntervals'
import { mergeProductCatalogWithDemos } from '@/lib/productMarketplaceDemos'
import { MarketplaceProductListSummary, formatInr } from '@/features/marketplace/productPricing'

function checkoutRedemptionCopy(p: MarketplaceProductDTO, cridoraFee: number): string {
  if (p.is_x_redeem && cridoraFee > 0) {
    return `Cross-jeweller settlement: Cridora adds a platform fee of ₹${formatInr(cridoraFee)} on this order. The jeweller does not charge this fee.`
  }
  if (p.is_x_redeem && cridoraFee <= 0) {
    return 'No Cridora cross-jeweller platform fee on this order (for example, when you already hold vaulted gold with this jeweller).'
  }
  return 'Same-store purchase: no Cridora cross-jeweller platform fee on this demo order.'
}

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

const chipBase: CSSProperties = {
  flex: '0 0 auto',
  padding: '0.35rem 0.65rem',
  borderRadius: 999,
  border: '1px solid var(--border-soft)',
  background: 'var(--accent-dim)',
  color: 'var(--text-muted)',
  fontSize: '0.62rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'var(--font)',
}

function CheckoutView({
  product,
  onBack,
}: {
  product: MarketplaceProductDTO
  onBack: () => void
}) {
  const weight = Number.parseFloat(product.gold_weight_grams)
  const [payMode, setPayMode] = useState<'cash' | 'vault'>('cash')
  const [vaultGrams, setVaultGrams] = useState(0)
  const [pricingCtx, setPricingCtx] = useState<CheckoutPricingContext | undefined>(undefined)
  /** Spendable vaulted grams custodied with this listing's jeweller (fractional + deposit + scheme). */
  const [eligibleGramsAtSeller, setEligibleGramsAtSeller] = useState(0)
  const [totalVaultedAllPartners, setTotalVaultedAllPartners] = useState(0)

  const refreshWallet = useCallback(async () => {
    const w = await fetchGoldWallet()
    if (!w) {
      setPricingCtx(undefined)
      setEligibleGramsAtSeller(0)
      setTotalVaultedAllPartners(0)
      return
    }
    setPricingCtx({
      customerDefaultJewellerId: w.default_jeweller_id,
      holdingsJewellerIds: holdingsJewellerIdsFromWallet(w),
    })
    setTotalVaultedAllPartners(walletBalanceGrams(w))
    setEligibleGramsAtSeller(vaultCheckoutEligibleGramsAtJeweller(w, product.jeweller_id))
  }, [product.jeweller_id])

  useEffect(() => {
    void refreshWallet()
  }, [refreshWallet])

  useLivePoll(refreshWallet, LIVE_BALANCE_POLL_MS, true)

  const metalRate = Number.parseFloat(product.metal_rate_inr_per_gram_used)
  const cashOnlyBreakdown = useMemo(
    () => calculateCheckoutPrice(product, 0, 0, pricingCtx),
    [product, pricingCtx],
  )
  const gramsSuggestedFullOrder = vaultGramsAtListingRateForOrderInr(
    cashOnlyBreakdown.finalAmount,
    metalRate,
  )
  const maxVaultGrams = eligibleGramsAtSeller

  useEffect(() => {
    setVaultGrams((g) => Math.min(g, maxVaultGrams))
  }, [maxVaultGrams])

  const p: PriceBreakdown = useMemo(
    () =>
      calculateCheckoutPrice(
        product,
        payMode === 'vault' ? vaultGrams : 0,
        eligibleGramsAtSeller,
        pricingCtx,
      ),
    [product, payMode, vaultGrams, eligibleGramsAtSeller, pricingCtx],
  )

  const payDisplay = Math.max(0, p.payableAmount)
  const vaultActive = payMode === 'vault'

  return (
    <div className="container page" style={{ paddingBottom: '4rem' }}>
      <button type="button" className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '1.5rem' }}>
        ← Back to catalogue
      </button>

      <h1 className="h1-page">Secure checkout</h1>
      <p className="lead lead-tight" style={{ marginBottom: '1.75rem' }}>
        Final amount is shown here only: jeweller metal and making lines, taxes, and — when applicable — a Cridora
        platform fee (never charged by the jeweller). Pay fully in gold from your vault at this jeweller’s listing rate,
        fully in cash / UPI, or any mix. Vault grams come from holdings <strong>custodied with {product.jeweller_name}</strong>{' '}
        (fractional, deposit, transfers, golden scheme). Gold is credited toward the bill at ₹
        {formatInr(Number.parseFloat(product.metal_rate_inr_per_gram_used), 2)}/g (this listing’s metal rate), up to the
        invoice total. Sellback notes are storefront disclosures only.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        <div className="card" style={{ padding: '1.5rem', borderRadius: 24, gridColumn: 'span 2 / auto' }}>
          <div
            style={{
              display: 'flex',
              gap: '1.25rem',
              alignItems: 'center',
              marginBottom: '1.25rem',
              paddingBottom: '1.25rem',
              borderBottom: '1px solid var(--border-soft)',
            }}
          >
            <div className="media-frame media-frame--checkout-thumb">
              <ProductPhoto src={product.image_url} alt="" />
            </div>
            <div>
              <p
                style={{
                  margin: '0 0 0.25rem',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--gold-light)',
                }}
              >
                {product.jeweller_name}
              </p>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{product.name}</h2>
              <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {product.category ? `${product.category} · ` : ''}
                {product.gold_weight_grams}g · {(product.metal_purity_label ?? '').trim() || 'Hallmark'} · Making{' '}
                {makingChargesShortLabel(product)}
                {product.stock_quantity != null ? ` · Stock ${product.stock_quantity}` : ''}
              </p>
              {product.stone_included ? (
                <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  Stone: {product.stone_type}
                  {product.stone_weight_grams ? ` · ${product.stone_weight_grams}g` : ''}
                  {product.stone_cost_inr ? ` · ₹${product.stone_cost_inr}` : ''}
                </p>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem' }}>
            <Row label="Gold + stone (metal layer)" value={`₹${formatInr(p.goldValue)}`} />
            <Row label="GST on gold (3%)" value={`₹${formatInr(p.gstOnGold, 2)}`} />
            <Row
              label="Making charges"
              value={
                <span>
                  <span
                    style={{
                      textDecoration: 'line-through',
                      color: 'var(--text-faint)',
                      marginRight: 8,
                      fontSize: '0.75rem',
                    }}
                  >
                    ₹{formatInr(p.makingCharges + p.discountAmount)}
                  </span>
                  ₹{formatInr(p.makingCharges)}
                </span>
              }
            />
            <Row label="GST on making (18%)" value={`₹${formatInr(p.gstOnMaking, 2)}`} />
            <Row
              label="Subtotal (jeweller)"
              value={`₹${formatInr(p.jewellerSubtotal)}`}
              muted
            />
            <Row
              label="Cridora platform fee (cross-network)"
              value={`₹${formatInr(p.crossPlatformFee)}`}
              muted
            />
            {p.crossPlatformFee > 0 ? (
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Charged by Cridora for cross-jeweller settlement — not by {product.jeweller_name}.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                No Cridora cross-network platform fee on this order in this demo.
              </p>
            )}
          </div>

          <div
            style={{
              marginTop: '1.25rem',
              padding: '1rem',
              borderRadius: 16,
              border: '1px solid var(--border-soft)',
              background: 'var(--veil-35)',
              fontSize: '0.82rem',
            }}
          >
            <Row
              label="Indicative sellback"
              value={`₹${formatInr(Number.parseFloat(product.sellback_indicative_inr_per_gram), 2)}/g`}
            />
            <Row label="Sellback deduction" value={`${product.sellback_deduction_percent}% + ₹${product.sellback_fixed_inr_per_gram}/g`} />
            {product.gold_deposit_note ? (
              <p style={{ margin: '0.75rem 0 0', color: 'var(--text-muted)' }}>{product.gold_deposit_note}</p>
            ) : null}
            <p style={{ margin: '0.75rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.45 }}>
              {checkoutRedemptionCopy(product, p.crossPlatformFee)}
            </p>
          </div>

          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--border-soft)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: '1rem',
              alignItems: 'flex-end',
            }}
          >
            <div>
              <p
                style={{
                  margin: '0 0 0.2rem',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                }}
              >
                Order total before vault credit
              </p>
              <p style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800 }} className="tabular">
                ₹{formatInr(p.finalAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', borderRadius: 24, position: 'sticky', top: 96 }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>Pay with</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
            <label
              style={{
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'flex-start',
                padding: '0.75rem',
                borderRadius: 14,
                border: payMode === 'cash' ? '2px solid var(--gold)' : '1px solid var(--border-soft)',
                background: payMode === 'cash' ? 'var(--gold-shine-12)' : 'var(--veil-35)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="pay-mode"
                checked={payMode === 'cash'}
                onChange={() => setPayMode('cash')}
                style={{ marginTop: 3 }}
              />
              <span style={{ fontSize: '0.88rem' }}>
                <strong>Cash / UPI only</strong>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
                  Pay the full order amount by cash or UPI.
                </span>
              </span>
            </label>
            <label
              style={{
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'flex-start',
                padding: '0.75rem',
                borderRadius: 14,
                border: payMode === 'vault' ? '2px solid var(--gold)' : '1px solid var(--border-soft)',
                background: payMode === 'vault' ? 'var(--gold-shine-12)' : 'var(--veil-35)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="pay-mode"
                checked={payMode === 'vault'}
                onChange={() => setPayMode('vault')}
                style={{ marginTop: 3 }}
              />
              <span style={{ fontSize: '0.88rem' }}>
                <strong>Cridora account (gold)</strong>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
                  <strong>Vault rate:</strong> ₹{formatInr(metalRate, 2)}/g · <strong>Suggested for full order:</strong>{' '}
                  <span className="tabular">{gramsSuggestedFullOrder.toFixed(3)}g</span> (covers ₹
                  {formatInr(cashOnlyBreakdown.finalAmount)} incl. taxes &amp; platform fee). You hold{' '}
                  <span className="tabular">{eligibleGramsAtSeller.toFixed(3)}g</span> with {product.jeweller_name}. Total
                  vaulted (all partners): <span className="tabular">{totalVaultedAllPartners.toFixed(3)}g</span>.
                </span>
              </span>
            </label>
          </div>

          {vaultActive ? (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', borderRadius: 12 }}
                  onClick={() =>
                    setVaultGrams(Math.min(maxVaultGrams, gramsSuggestedFullOrder))
                  }
                  disabled={maxVaultGrams <= 0 || !Number.isFinite(gramsSuggestedFullOrder)}
                >
                  Use suggested — pay full order in gold
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', borderRadius: 12 }}
                  onClick={() => setVaultGrams(maxVaultGrams)}
                  disabled={maxVaultGrams <= 0}
                >
                  Apply max available ({maxVaultGrams.toFixed(3)}g)
                </button>
              </div>
              <label htmlFor="vault-grams" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Grams at vault rate (0 – {maxVaultGrams.toFixed(3)})
              </label>
              <input
                id="vault-grams"
                type="range"
                min={0}
                max={maxVaultGrams}
                step={0.001}
                value={Math.min(vaultGrams, maxVaultGrams)}
                onChange={(e) => setVaultGrams(Number.parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
              <input
                type="number"
                min={0}
                max={maxVaultGrams}
                step={0.001}
                value={vaultGrams}
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value)
                  if (!Number.isFinite(v)) setVaultGrams(0)
                  else setVaultGrams(Math.max(0, Math.min(maxVaultGrams, v)))
                }}
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  borderRadius: 10,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--veil)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font)',
                }}
              />
              <p
                className="form-footnote"
                style={{
                  margin: '0.45rem 0 0',
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.45,
                }}
              >
                Golden scheme grams count once credited to your vault here. If your jeweller enforces a scheme lock-in,
                only unlocked portions are spendable once that rule is on your ledger.
              </p>
            </div>
          ) : null}

          <div
            style={{
              padding: '1rem',
              borderRadius: 16,
              border: vaultActive && vaultGrams > 0 ? '2px solid var(--gold)' : '1px solid var(--border-soft)',
              background: vaultActive && vaultGrams > 0 ? 'var(--gold-shine-12)' : 'var(--veil-35)',
              marginBottom: '1rem',
            }}
          >
            {vaultActive && vaultGrams > 0 ? (
              <div
                style={{
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  background: 'var(--veil-40)',
                  padding: '0.85rem',
                  borderRadius: 14,
                }}
              >
                <Row label="Grams selected (vault rate)" value={<strong>{vaultGrams.toFixed(3)}g</strong>} muted />
                <Row
                  label="Credit toward order (capped at invoice)"
                  value={<strong style={{ color: 'var(--success)' }}>₹{formatInr(p.vaultValueOffset)}</strong>}
                  muted
                />
                <Row
                  label="Grams counted on this bill"
                  value={<strong className="tabular">{p.goldFromVault.toFixed(3)}g</strong>}
                  muted
                />
                {vaultGrams * metalRate > p.finalAmount + 1e-6 ? (
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Invoice fully covered — credit stops at ₹{formatInr(p.finalAmount)}; extra gram selection is not needed
                    for this order.
                  </p>
                ) : null}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {vaultActive
                  ? 'Move the slider to apply gold from your Cridora account.'
                  : 'Pay the full order total with cash or UPI.'}
              </p>
            )}
          </div>

          <div
            style={{
              padding: '1rem',
              borderRadius: 16,
              border: '1px solid var(--border-soft)',
              background: 'var(--veil-35)',
              marginBottom: '1rem',
            }}
          >
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {vaultActive && vaultGrams > 0 ? 'Remaining (cash / UPI)' : 'Due now (cash / UPI)'}
            </p>
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }} className="tabular">
              ₹{formatInr(payDisplay)}
            </p>
          </div>

          <button type="button" className="btn btn-primary" style={{ width: '100%' }}>
            {payDisplay <= 0 && vaultActive && vaultGrams > 0
              ? 'Confirm — vault covers this order'
              : payDisplay <= 0
                ? 'Confirm payment'
                : vaultActive && vaultGrams > 0
                  ? `Pay ₹${formatInr(payDisplay)} cash + vault`
                  : `Pay ₹${formatInr(payDisplay)} with cash / UPI`}
          </button>

          <p className="form-footnote" style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.72rem' }}>
            Demo checkout · piece {weight.toFixed(3)}g
            {vaultActive && vaultGrams > 0
              ? ` · ~${p.goldFromVault.toFixed(3)}g valued toward this bill at confirm`
              : ''}
          </p>
        </div>
      </div>
    </div>
  )
}

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

function cmpJewellerName(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' })
}

export function ProductMarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const jewellerParam = searchParams.get('jeweller')
  const jewellerFilterId =
    jewellerParam && /^\d+$/.test(jewellerParam) ? Number.parseInt(jewellerParam, 10) : undefined

  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [productSort, setProductSort] = useState<
    'featured' | 'price_asc' | 'price_desc' | 'weight_asc' | 'weight_desc' | 'jeweller'
  >('featured')
  const [jewellerOptions, setJewellerOptions] = useState<JewellerStorefrontDTO[]>([])
  const [checkoutProduct, setCheckoutProduct] = useState<MarketplaceProductDTO | null>(null)
  const [catalog, setCatalog] = useState<MarketplaceProductDTO[]>([])
  const [loadError, setLoadError] = useState('')
  const [cartQtyById, setCartQtyById] = useState<Record<number, number>>({})
  const [goldWallet, setGoldWallet] = useState<GoldWalletDTO | null>(null)

  const cartItemCount = useMemo(
    () => Object.values(cartQtyById).reduce((sum, n) => sum + n, 0),
    [cartQtyById],
  )

  const addToCart = useCallback((product: MarketplaceProductDTO) => {
    setCartQtyById((prev) => ({ ...prev, [product.id]: (prev[product.id] ?? 0) + 1 }))
  }, [])

  const clearCart = useCallback(() => {
    setCartQtyById({})
  }, [])

  const refreshCatalog = useCallback(async () => {
    setLoadError('')
    const jewellerApiId =
      jewellerFilterId != null && jewellerFilterId > 0 ? jewellerFilterId : undefined
    const rows = await fetchMarketplaceProducts({
      jewellerId: jewellerApiId,
    })
    let merged = mergeProductCatalogWithDemos(rows)
    if (jewellerFilterId != null) {
      merged = merged.filter((p) => p.jeweller_id === jewellerFilterId)
    }
    setCatalog(merged)
  }, [jewellerFilterId])

  const refreshJewellerOptions = useCallback(async () => {
    const list = await fetchVerifiedJewellers()
    setJewellerOptions(mergeJewellerListWithDemos(list))
  }, [])

  const refreshVaultBalance = useCallback(async () => {
    setGoldWallet(await fetchGoldWallet())
  }, [])

  useEffect(() => {
    void refreshVaultBalance()
  }, [refreshVaultBalance])

  useLivePoll(refreshVaultBalance, LIVE_BALANCE_POLL_MS, true)

  const checkoutParam = searchParams.get('checkout')
  useEffect(() => {
    if (!checkoutParam || !/^\d+$/.test(checkoutParam)) {
      setCheckoutProduct(null)
      return
    }
    const id = Number.parseInt(checkoutParam, 10)
    const found = catalog.find((c) => c.id === id)
    if (found) {
      setCheckoutProduct(found)
      return
    }
    void fetchMarketplaceProduct(id).then((p) => {
      if (p) setCheckoutProduct(p)
      else setCheckoutProduct(null)
    })
  }, [checkoutParam, catalog])

  useEffect(() => {
    void refreshCatalog()
  }, [refreshCatalog])

  useLivePoll(refreshCatalog, LIVE_CATALOG_POLL_MS, true)

  useLivePoll(refreshJewellerOptions, LIVE_DIRECTORY_POLL_MS, true)

  useEffect(() => {
    void refreshJewellerOptions()
  }, [refreshJewellerOptions])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const p of catalog) {
      set.add(p.category)
    }
    return ['All', ...Array.from(set).sort()]
  }, [catalog])

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return catalog.filter((p) => {
      const catOk = activeCategory === 'All' || p.category === activeCategory
      const searchOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.jeweller_name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        q.includes('916') ||
        q.includes('bis')
      return catOk && searchOk
    })
  }, [activeCategory, searchQuery, catalog])

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts]
    const sortPrice = (p: MarketplaceProductDTO) => calculateCheckoutPrice(p, 0, 0).finalAmount
    const weight = (p: MarketplaceProductDTO) => Number.parseFloat(p.gold_weight_grams)
    if (productSort === 'price_asc') {
      list.sort((a, b) => sortPrice(a) - sortPrice(b))
    } else if (productSort === 'price_desc') {
      list.sort((a, b) => sortPrice(b) - sortPrice(a))
    } else if (productSort === 'weight_asc') {
      list.sort((a, b) => weight(a) - weight(b))
    } else if (productSort === 'weight_desc') {
      list.sort((a, b) => weight(b) - weight(a))
    } else if (productSort === 'jeweller') {
      list.sort((a, b) => cmpJewellerName(a.jeweller_name, b.jeweller_name))
    }
    return list
  }, [filteredProducts, productSort])

  const closeCheckout = useCallback(() => {
    setCheckoutProduct(null)
    const next = new URLSearchParams(searchParams)
    next.delete('checkout')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const openCheckout = useCallback(
    (p: MarketplaceProductDTO) => {
      setCheckoutProduct(p)
      const next = new URLSearchParams(searchParams)
      next.set('checkout', String(p.id))
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const setJewellerFilter = useCallback(
    (id: number | undefined) => {
      const next = new URLSearchParams(searchParams)
      if (id == null || !Number.isFinite(id)) {
        next.delete('jeweller')
      } else {
        next.set('jeweller', String(id))
      }
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  if (checkoutProduct) {
    return <CheckoutView product={checkoutProduct} onBack={closeCheckout} />
  }

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <section
        style={{
          position: 'relative',
          padding: '2.75rem 0 6.5rem',
          overflow: 'hidden',
          background: 'var(--gradient-hero-band)',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'var(--radial-gold)',
          }}
        />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <span className="pill">BIS 916 · Verified jewellers</span>
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              margin: '0.75rem 0',
              textTransform: 'uppercase',
              fontStyle: 'italic',
              letterSpacing: '-0.03em',
            }}
          >
            Product <span style={{ color: 'var(--gold-light)' }}>marketplace</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: '42rem', margin: 0, fontSize: '1rem' }}>
            Browse by name, gold weight, and final price (incl. taxes). Open a piece for metal rate, GST, making charges,
            stones, vault estimate, and sellback notes.{' '}
            <Link to="/jewellers" style={{ color: 'var(--gold-light)' }}>
              Compare jewellers
            </Link>{' '}
            for sellback and lock-in.
          </p>
          {loadError ? (
            <p className="form-error" style={{ marginTop: '1rem' }}>
              {loadError}
            </p>
          ) : null}
        </div>
      </section>

      <div className="container" style={{ marginTop: '-2.75rem', position: 'relative', zIndex: 2 }}>
        <div
          className="card"
          style={{
            padding: '1.25rem',
            borderRadius: 24,
            boxShadow: 'var(--shadow-card)',
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
                placeholder="Search collection, purity, or jewellers…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...filterBarInput, paddingLeft: '2.25rem' }}
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ borderRadius: 16, minHeight: 48 }}
              onClick={() => {
                void refreshCatalog()
                void refreshJewellerOptions()
              }}
            >
              Refresh
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.75rem',
              marginTop: '0.75rem',
              alignItems: 'stretch',
            }}
          >
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
            <select
              aria-label="Sort products"
              value={productSort}
              onChange={(e) =>
                setProductSort(
                  e.target.value as
                    | 'featured'
                    | 'price_asc'
                    | 'price_desc'
                    | 'weight_asc'
                    | 'weight_desc'
                    | 'jeweller',
                )
              }
              style={{ ...filterBarInput, cursor: 'pointer' }}
            >
              <option value="featured">Sort: featured</option>
              <option value="price_asc">Price: low → high</option>
              <option value="price_desc">Price: high → low</option>
              <option value="weight_asc">Weight: low → high</option>
              <option value="weight_desc">Weight: high → low</option>
              <option value="jeweller">Jeweller A–Z</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '1rem' }}>
            {categories.map((cat) => {
              const active = activeCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    ...chipBase,
                    borderColor: active ? 'rgba(180, 130, 48, 0.45)' : 'var(--border-soft)',
                    background: active ? 'var(--gold-soft)' : 'var(--accent-dim)',
                    color: active ? 'var(--gold-light)' : 'var(--text-muted)',
                  }}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            marginTop: '2rem',
            marginBottom: '1.25rem',
          }}
        >
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Showing <strong style={{ color: 'var(--text)' }}>{sortedProducts.length}</strong> pieces
            {activeCategory !== 'All' ? ` · ${activeCategory}` : ''}
            {jewellerFilterId != null
              ? ` · jeweller #${jewellerFilterId}`
              : ''}
            {cartItemCount > 0 ? (
              <>
                {' · '}
                <span style={{ color: 'var(--gold-light)' }}>Cart {cartItemCount}</span>
                {' · '}
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.1rem 0.45rem', fontSize: '0.78rem', verticalAlign: 'baseline' }}
                  onClick={clearCart}
                >
                  Clear cart
                </button>
              </>
            ) : null}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
            <div
              className="card"
              style={{
                margin: 0,
                padding: '0.65rem 0.85rem',
                borderRadius: 14,
                minWidth: 130,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '0.6rem',
                  color: 'var(--text-faint)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Vault balance (all partners)
              </p>
              <p style={{ margin: '0.2rem 0 0', fontWeight: 800 }} className="tabular">
                {walletBalanceGrams(goldWallet).toFixed(3)}g
              </p>
            </div>
            <div
              className="card"
              style={{
                margin: 0,
                padding: '0.65rem 0.85rem',
                borderRadius: 14,
                minWidth: 200,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '0.6rem',
                  color: 'var(--text-faint)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Metal pricing
              </p>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                ₹/g on each piece is the <strong style={{ color: 'var(--text)' }}>jeweller&apos;s rate</strong>. Open a listing for
                the live amount and last update time.
              </p>
            </div>
          </div>
        </div>

        {sortedProducts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            No approved listings yet. Jewellers publish SKUs from their dashboard; Cridora admins approve them under
            Marketplace → Product approval before they appear here.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {sortedProducts.map((p, idx) => (
              <article
                key={p.id}
                className="card cridora-card-motion cridora-reveal"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 24,
                  ['--reveal-delay' as string]: `${idx * 0.055}s`,
                } as CSSProperties}
              >
                <div className="media-frame media-frame--product-card">
                  <Link
                    to={`/marketplace/product/${p.id}`}
                    className="media-frame__hit"
                    aria-label={`View details for ${p.name}`}
                  >
                    <ProductPhoto src={p.image_url} alt="" />
                  </Link>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'var(--gradient-image-fade)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
                <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h2 style={{ margin: '0 0 0.85rem', fontSize: '1.05rem', lineHeight: 1.25 }}>{p.name}</h2>
                  <div style={{ marginBottom: '0.85rem' }}>
                    <MarketplaceProductListSummary
                      p={p}
                      portfolioVaultGrams={vaultCheckoutEligibleGramsAtJeweller(goldWallet, p.jeweller_id)}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: 'auto',
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--border-soft)',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.5rem',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '0.5rem 0.65rem' }}
                      onClick={() => addToCart(p)}
                    >
                      Add to cart
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0.5rem 0.65rem' }}
                      onClick={() => openCheckout(p)}
                    >
                      Buy now
                    </button>
                    <Link
                      to={`/marketplace/product/${p.id}`}
                      className="btn btn-ghost"
                      style={{ padding: '0.5rem 0.65rem', gridColumn: '1 / -1', textAlign: 'center', textDecoration: 'none' }}
                    >
                      Full details
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <aside
          className="card"
          style={{
            marginTop: '2.5rem',
            maxWidth: 420,
            marginLeft: 'auto',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
          }}
        >
          <p
            style={{
              margin: '0 0 0.35rem',
              fontWeight: 800,
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--text-faint)',
            }}
          >
            Operational note
          </p>
          <p style={{ margin: 0 }}>
            Pricing pulls from `/api/v1/marketplace/products/` for KYB-verified jewellers (no separate product approval queue).
            Categories and hallmark masters are edited in Django admin; each listing carries purity and stock from the jeweller
            catalogue. Sellback lines are storefront disclosures; settlement follows vault ledger and showroom agreements.
          </p>
        </aside>

        <p style={{ marginTop: '2rem' }}>
          <Link to="/signup" className="btn btn-primary">
            Get started as a customer
          </Link>
        </p>
      </div>
    </div>
  )
}
