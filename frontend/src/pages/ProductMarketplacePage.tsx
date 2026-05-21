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
import { VaultGoldTaxSavingsNotice } from '@/features/gold/VaultGoldTaxSavingsNotice'
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
  suggestedVaultGramsForFullOrder,
  type CheckoutPricingContext,
  type PriceBreakdown,
} from '@/lib/marketplacePricing'
import {
  MarketplaceCashPayPage,
  MarketplaceCheckoutReceiptCard,
  useMarketplaceOrderConfirm,
  type MarketplaceCheckoutReceipt,
} from '@/features/marketplace/MarketplaceCheckoutFlow'
import { useAuth } from '@/context/AuthContext'
import { fetchGoldWallet, holdingsJewellerIdsFromWallet, vaultCheckoutEligibleGramsAtJeweller, walletBalanceGrams, type GoldWalletDTO } from '@/lib/goldTransferApi'
import { mergeJewellerListWithDemos } from '@/lib/jewellerMarketplaceDemos'
import { LIVE_BALANCE_POLL_MS, LIVE_CATALOG_POLL_MS, LIVE_DIRECTORY_POLL_MS } from '@/lib/liveDeskIntervals'
import { mergeProductCatalogWithDemos } from '@/lib/productMarketplaceDemos'
import { MarketplaceProductListSummary, formatInr } from '@/features/marketplace/productPricing'
import { VaultCheckoutGramsControl } from '@/features/marketplace/VaultCheckoutGramsControl'
import {
  MarketplaceCartCheckout,
  MarketplaceCartReview,
} from '@/features/marketplace/MarketplaceCartViews'
import { useMarketplaceCart } from '@/features/marketplace/useMarketplaceCart'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import type { MessageKey } from '@/i18n/messages/en'

const PRODUCT_CARDS: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { titleKey: 'products.card1Title', bodyKey: 'products.card1Body' },
  { titleKey: 'products.card2Title', bodyKey: 'products.card2Body' },
  { titleKey: 'products.card3Title', bodyKey: 'products.card3Body' },
  { titleKey: 'products.card4Title', bodyKey: 'products.card4Body' },
  { titleKey: 'products.card5Title', bodyKey: 'products.card5Body' },
]

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
  const { user } = useAuth()
  const [payMode, setPayMode] = useState<'cash' | 'vault'>('cash')
  const [vaultGrams, setVaultGrams] = useState(0)
  const [pricingCtx, setPricingCtx] = useState<CheckoutPricingContext | undefined>(undefined)
  const [checkoutStep, setCheckoutStep] = useState<'pay' | 'cash' | 'receipt'>('pay')
  const [receipt, setReceipt] = useState<MarketplaceCheckoutReceipt | null>(null)
  /** Spendable vaulted grams custodied with this listing's jeweller (fractional + deposit + scheme). */
  const [eligibleGramsAtSeller, setEligibleGramsAtSeller] = useState(0)
  const [totalVaultedAllPartners, setTotalVaultedAllPartners] = useState(0)
  const [walletLoading, setWalletLoading] = useState(true)

  const refreshWallet = useCallback(async () => {
    const w = await fetchGoldWallet()
    if (!w) {
      setPricingCtx(undefined)
      setEligibleGramsAtSeller(0)
      setTotalVaultedAllPartners(0)
      setWalletLoading(false)
      return
    }
    setPricingCtx({
      customerDefaultJewellerId: w.default_jeweller_id,
      holdingsJewellerIds: holdingsJewellerIdsFromWallet(w),
    })
    setTotalVaultedAllPartners(walletBalanceGrams(w))
    setEligibleGramsAtSeller(vaultCheckoutEligibleGramsAtJeweller(w, product.jeweller_id))
    setWalletLoading(false)
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
  const gramsSuggestedFullOrder = suggestedVaultGramsForFullOrder(
    product,
    eligibleGramsAtSeller,
    pricingCtx,
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
  const kycOk = user?.kyc_status === 'verified'
  const metalRateOk = Number.isFinite(metalRate) && metalRate > 0

  useEffect(() => {
    if (payMode !== 'vault' || maxVaultGrams <= 0 || !metalRateOk) return
    const target =
      Number.isFinite(gramsSuggestedFullOrder) && gramsSuggestedFullOrder > 0
        ? Math.min(maxVaultGrams, gramsSuggestedFullOrder)
        : maxVaultGrams
    setVaultGrams((g) => (g > 1e-6 ? Math.min(g, maxVaultGrams) : target))
  }, [payMode, maxVaultGrams, metalRateOk, gramsSuggestedFullOrder])

  const { busy, error, setError, runConfirm } = useMarketplaceOrderConfirm({
    product,
    vaultGrams,
    payMode,
    breakdown: p,
    onSuccess: (r) => {
      setReceipt(r)
      setCheckoutStep('receipt')
    },
  })

  const onPrimaryPay = () => {
    setError('')
    if (product.id < 1) {
      setError('Demo listings cannot be purchased — choose a real jeweller SKU from the catalogue.')
      return
    }
    if (!Number.isFinite(metalRate) || metalRate <= 0) {
      setError('This listing has no metal ₹/g. Ask the jeweller to set pricing on the SKU.')
      return
    }
    if (cashOnlyBreakdown.finalAmount <= 0) {
      setError('Order total is ₹0 — check gold weight and making charges on this listing.')
      return
    }
    if (!kycOk) {
      setError('Complete KYC before checkout.')
      return
    }
    if (payDisplay <= 0 && (vaultActive ? vaultGrams > 0 : true)) {
      void runConfirm('')
      return
    }
    if (payDisplay > 0) {
      setCheckoutStep('cash')
    }
  }

  if (checkoutStep === 'receipt' && receipt) {
    return (
      <div className="container page" style={{ paddingBottom: '4rem' }}>
        <MarketplaceCheckoutReceiptCard receipt={receipt} onDone={onBack} />
      </div>
    )
  }

  if (checkoutStep === 'cash') {
    return (
      <MarketplaceCashPayPage
        amountInr={payDisplay}
        jewellerName={product.jeweller_name}
        productLabel={product.name}
        vaultNote={
          vaultActive && vaultGrams > 0 ? (
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              <strong className="tabular">{vaultGrams.toFixed(3)} g</strong> from your Cridora vault will be debited when
              you complete cash payment.
            </p>
          ) : undefined
        }
        busy={busy}
        error={error}
        onBack={() => setCheckoutStep('pay')}
        onPaid={(method) => void runConfirm(method)}
      />
    )
  }

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
            <Row label="Gold metal" value={`₹${formatInr(p.goldMetalValue)}`} />
            {p.stoneComponent > 0 ? (
              <Row
                label={
                  product.stone_type?.trim()
                    ? `Stone (${product.stone_type.trim()}${product.stone_weight_grams ? ` · ${product.stone_weight_grams}g` : ''})`
                    : 'Stone (jeweller-listed)'
                }
                value={`₹${formatInr(p.stoneComponent)}`}
              />
            ) : null}
            <Row
              label={
                vaultActive && vaultGrams > 0 && p.gstOnGoldSaved > 0
                  ? 'GST on gold metal (vault-exempt portion)'
                  : 'GST on gold metal (3%)'
              }
              value={`₹${formatInr(p.gstOnGold, 2)}`}
            />
            {vaultActive && vaultGrams > 0 ? <VaultGoldTaxSavingsNotice gstSavedInr={p.gstOnGoldSaved} compact /> : null}
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
                  <strong>Vault rate:</strong> ₹{formatInr(metalRate, 2)}/g ·                   <strong>Suggested for full order:</strong>{' '}
                  <span className="tabular">{gramsSuggestedFullOrder.toFixed(3)}g</span> (after GST relief on vaulted
                  gold — not the higher pre-relief gram count). You hold{' '}
                  <span className="tabular">{eligibleGramsAtSeller.toFixed(3)}g</span> with {product.jeweller_name}. Total
                  vaulted (all partners): <span className="tabular">{totalVaultedAllPartners.toFixed(3)}g</span>.
                </span>
              </span>
            </label>
          </div>

          {vaultActive ? (
            <div style={{ marginBottom: '1rem' }}>
              <VaultCheckoutGramsControl
                maxGrams={maxVaultGrams}
                grams={vaultGrams}
                suggestedGrams={gramsSuggestedFullOrder}
                metalRateOk={metalRateOk}
                walletLoading={walletLoading}
                jewellerName={product.jeweller_name}
                totalVaultedAllPartners={totalVaultedAllPartners}
                onGramsChange={setVaultGrams}
                rangeId="vault-grams"
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
                <Row label="Grams debited from vault" value={<strong className="tabular">{p.goldFromVault.toFixed(3)}g</strong>} muted />
                <Row
                  label="Credited on bill (vault rate)"
                  value={<strong className="tabular">{p.gramsCreditedOnBill.toFixed(3)}g</strong>}
                  muted
                />
                <Row
                  label="Of which · metal line only"
                  value={<strong className="tabular">{p.gramsMetalPortion.toFixed(3)}g</strong>}
                  muted
                />
                <Row
                  label="Vault metal credit"
                  value={<strong style={{ color: 'var(--success)' }}>₹{formatInr(p.vaultMetalCredit)}</strong>}
                  muted
                />
                <VaultGoldTaxSavingsNotice gstSavedInr={p.gstOnGoldSaved} />
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

          {payDisplay > 0 ? (
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
          ) : null}

          {!kycOk ? (
            <p className="form-error" style={{ marginBottom: '0.75rem' }}>
              Complete KYC before checkout.{' '}
              <Link to="/userdashboard?section=profile_kyc">Open KYC</Link>
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert" style={{ marginBottom: '0.75rem' }}>
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={busy || !kycOk}
            onClick={onPrimaryPay}
          >
            {busy
              ? 'Processing…'
              : payDisplay <= 0 && vaultActive && vaultGrams > 0
                ? 'Confirm — vault covers this order'
                : payDisplay <= 0
                  ? 'Confirm payment'
                  : vaultActive && vaultGrams > 0
                    ? 'Continue to cash payment →'
                    : 'Continue to payment →'}
          </button>
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
  const { t } = usePublicLocale()
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
  const [goldWallet, setGoldWallet] = useState<GoldWalletDTO | null>(null)
  const [cartExtras, setCartExtras] = useState<Record<number, MarketplaceProductDTO>>({})
  const [cartToast, setCartToast] = useState('')

  const {
    qtyById,
    cartItemCount,
    addToCart,
    setLineQty,
    removeLine,
    clearCart,
  } = useMarketplaceCart()

  useEffect(() => {
    if (!cartToast) return
    const t = window.setTimeout(() => setCartToast(''), 2800)
    return () => window.clearTimeout(t)
  }, [cartToast])

  const pricingCtxCatalog = useMemo(() => {
    if (!goldWallet) return undefined
    return {
      customerDefaultJewellerId: goldWallet.default_jeweller_id,
      holdingsJewellerIds: holdingsJewellerIdsFromWallet(goldWallet),
    }
  }, [goldWallet])

  const resolvedCartLines = useMemo(() => {
    const out: { product: MarketplaceProductDTO; qty: number }[] = []
    for (const idStr of Object.keys(qtyById)) {
      const id = Number.parseInt(idStr, 10)
      const qty = qtyById[id]
      if (!Number.isFinite(id) || !qty || qty < 1) continue
      const product = catalog.find((c) => c.id === id) ?? cartExtras[id]
      if (product) out.push({ product, qty })
    }
    return out
  }, [qtyById, catalog, cartExtras])

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
  const cartPageOpen = searchParams.get('cart') === '1'

  useEffect(() => {
    if (checkoutParam === 'cart') {
      setCheckoutProduct(null)
      return
    }
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
    if (checkoutParam !== 'cart') return
    if (resolvedCartLines.length > 0) return
    const next = new URLSearchParams(searchParams)
    next.delete('checkout')
    setSearchParams(next, { replace: true })
  }, [checkoutParam, resolvedCartLines.length, searchParams, setSearchParams])

  useEffect(() => {
    if (!cartPageOpen && checkoutParam !== 'cart') return
    for (const idStr of Object.keys(qtyById)) {
      const id = Number.parseInt(idStr, 10)
      if (!Number.isFinite(id)) continue
      if (catalog.some((c) => c.id === id)) continue
      void fetchMarketplaceProduct(id).then((p) => {
        if (p) setCartExtras((e) => (e[id] ? e : { ...e, [id]: p }))
      })
    }
  }, [cartPageOpen, checkoutParam, qtyById, catalog])

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

  const openCartReview = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.set('cart', '1')
    next.delete('checkout')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const handleAddToCart = useCallback(
    (p: MarketplaceProductDTO) => {
      const r = addToCart(p, 1)
      setCartToast(r.message)
    },
    [addToCart],
  )

  const openCheckout = useCallback(
    (p: MarketplaceProductDTO) => {
      setCheckoutProduct(p)
      const next = new URLSearchParams(searchParams)
      next.set('checkout', String(p.id))
      next.delete('cart')
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

  if (checkoutParam === 'cart') {
    return (
      <MarketplaceCartCheckout
        lines={resolvedCartLines}
        pricingCtx={pricingCtxCatalog}
        onBack={() => {
          const next = new URLSearchParams(searchParams)
          next.delete('checkout')
          next.set('cart', '1')
          setSearchParams(next, { replace: true })
        }}
      />
    )
  }

  if (checkoutProduct) {
    return <CheckoutView product={checkoutProduct} onBack={closeCheckout} />
  }

  if (cartPageOpen) {
    return (
      <MarketplaceCartReview
        lines={resolvedCartLines}
        pricingCtx={pricingCtxCatalog}
        onBack={() => {
          const next = new URLSearchParams(searchParams)
          next.delete('cart')
          setSearchParams(next, { replace: true })
        }}
        onProceedToPayment={() => {
          const next = new URLSearchParams(searchParams)
          next.set('checkout', 'cart')
          next.delete('cart')
          setSearchParams(next, { replace: true })
        }}
        onChangeQty={setLineQty}
        onRemoveLine={removeLine}
      />
    )
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
          <span className="pill">{t('products.pill')}</span>
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              margin: '0.75rem 0',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {t('products.heroTitle')}
          </h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: '46rem', margin: 0, fontSize: '1rem', lineHeight: 1.55 }}>
            {t('products.heroLead')}{' '}
            <Link to="/jewellers" style={{ color: 'var(--gold-light)' }}>
              {t('home.ctaExploreJewellers')}
            </Link>
            .
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
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}
        >
          {PRODUCT_CARDS.map((card) => (
            <div key={card.titleKey} className="card" style={{ padding: '1rem', borderRadius: 16 }}>
              <h2 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--gold-light)' }}>{t(card.titleKey)}</h2>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {t(card.bodyKey)}
              </p>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: '1.15rem 1.25rem', borderRadius: 18, marginBottom: '1.25rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>{t('products.philosophyTitle')}</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
            {t('products.philosophyBody')}
          </p>
        </div>

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
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Showing <strong style={{ color: 'var(--text)' }}>{sortedProducts.length}</strong> pieces
              {activeCategory !== 'All' ? ` · ${activeCategory}` : ''}
              {jewellerFilterId != null ? ` · jeweller #${jewellerFilterId}` : ''}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.4rem 0.95rem', fontSize: '0.82rem', borderRadius: 12 }}
              onClick={openCartReview}
            >
              {cartItemCount > 0 ? `Cart · ${cartItemCount}` : 'Cart'}
            </button>
            {cartItemCount > 0 ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem', borderRadius: 12 }}
                onClick={clearCart}
              >
                Clear cart
              </button>
            ) : null}
          </div>
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
                      onClick={() => handleAddToCart(p)}
                    >
                      {(qtyById[p.id] ?? 0) > 0 ? `In cart · ${qtyById[p.id]}` : 'Add to cart'}
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
            maxWidth: 520,
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            lineHeight: 1.55,
          }}
        >
          <p style={{ margin: 0 }}>{t('products.transparencyNote')}</p>
        </aside>

        <p style={{ marginTop: '2rem' }}>
          <Link to="/signup" className="btn btn-primary">
            {t('home.ctaStartSaving')}
          </Link>
        </p>
      </div>

      {cartToast ? (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            padding: '0.65rem 1.1rem',
            borderRadius: 14,
            background: 'var(--veil-90)',
            border: '1px solid var(--gold)',
            color: 'var(--text)',
            fontSize: '0.85rem',
            boxShadow: 'var(--shadow-card)',
            maxWidth: 'min(90vw, 380px)',
            textAlign: 'center',
          }}
        >
          {cartToast}
        </div>
      ) : null}
    </div>
  )
}
