import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ProductPhoto } from '@/components/ProductPhoto'
import {
  calculateCheckoutPrice,
  cartBlendedMetalRateInrPerGram,
  makingChargesShortLabel,
  maxOrderQtyForProduct,
  vaultGramsAtListingRateForOrderInr,
  type CheckoutPricingContext,
  type PriceBreakdown,
} from '@/lib/marketplacePricing'
import {
  fetchGoldWallet,
  vaultCheckoutEligibleGramsAtJeweller,
  walletBalanceGrams,
  type GoldWalletDTO,
} from '@/lib/goldTransferApi'
import { useLivePoll } from '@/lib/useLivePoll'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import type { MarketplaceProductDTO } from '@/lib/marketplaceApi'
import { formatInr } from '@/features/marketplace/productPricing'
import { suggestedVaultGramsForFullOrder } from '@/lib/marketplacePricing'
import { useAuth } from '@/context/AuthContext'
import {
  MarketplaceCashPayStep,
  MarketplaceCheckoutReceiptCard,
  useMarketplaceOrderConfirm,
  type MarketplaceCheckoutReceipt,
} from '@/features/marketplace/MarketplaceCheckoutFlow'

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

export type CartLine = { product: MarketplaceProductDTO; qty: number }

function checkoutRedemptionCopyMulti(
  lines: CartLine[],
  totalCrossFee: number,
): string {
  const anyX = lines.some((l) => l.product.is_x_redeem)
  if (!anyX) {
    return 'Same-store / in-network pieces: no Cridora cross-network platform fee on this demo order for applicable lines.'
  }
  if (totalCrossFee > 0) {
    return `Cross-jeweller lines include a Cridora platform fee (total ₹${formatInr(totalCrossFee)} on this order). Jewellers do not charge this fee.`
  }
  return 'No Cridora cross-network platform fee on this order (for example, when vaulted gold is held with each listing jeweller).'
}

export function MarketplaceCartReview({
  lines,
  pricingCtx,
  onBack,
  onProceedToPayment,
  onChangeQty,
  onRemoveLine,
}: {
  lines: CartLine[]
  pricingCtx?: CheckoutPricingContext
  onBack: () => void
  onProceedToPayment: () => void
  onChangeQty: (product: MarketplaceProductDTO, qty: number) => void
  onRemoveLine: (productId: number) => void
}) {
  const computed = useMemo(() => {
    let jewellerSub = 0
    let platform = 0
    let final = 0
    const rows: { line: CartLine; unit: PriceBreakdown; lineTotal: PriceBreakdown }[] = []
    for (const line of lines) {
      const unit = calculateCheckoutPrice(line.product, 0, 0, pricingCtx, 1)
      const lineTotal = calculateCheckoutPrice(line.product, 0, 0, pricingCtx, line.qty)
      jewellerSub += lineTotal.jewellerSubtotal
      platform += lineTotal.crossPlatformFee
      final += lineTotal.finalAmount
      rows.push({ line, unit, lineTotal })
    }
    return { rows, jewellerSub, platform, final }
  }, [lines, pricingCtx])

  if (lines.length === 0) {
    return (
      <div className="container page" style={{ paddingBottom: '4rem' }}>
        <button type="button" className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '1.25rem' }}>
          ← Back to marketplace
        </button>
        <h1 className="h1-page">Your cart</h1>
        <p className="lead lead-tight" style={{ color: 'var(--text-muted)' }}>
          Your cart is empty. Browse pieces and tap <strong>Add to cart</strong>.
        </p>
        <Link to="/marketplace" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Continue shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="container page" style={{ paddingBottom: '4rem', maxWidth: 720 }}>
      <button type="button" className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '1.25rem' }}>
        ← Continue shopping
      </button>
      <h1 className="h1-page">Cart</h1>
      <p className="lead lead-tight" style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
        Review quantities and amounts. Taxes and platform fees are included in each line total.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {computed.rows.map(({ line, unit, lineTotal }) => {
          const p = line.product
          const max = maxOrderQtyForProduct(p)
          const rate = Number.parseFloat(p.metal_rate_inr_per_gram_used)
          return (
            <div
              key={p.id}
              className="card"
              style={{
                padding: '1rem 1.15rem',
                borderRadius: 18,
                display: 'grid',
                gridTemplateColumns: '88px 1fr',
                gap: '1rem',
                alignItems: 'start',
              }}
            >
              <Link to={`/marketplace/product/${p.id}`} className="media-frame media-frame--checkout-thumb" style={{ borderRadius: 14 }}>
                <ProductPhoto src={p.image_url} alt="" />
              </Link>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: '0 0 0.15rem',
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--gold-light)',
                  }}
                >
                  {p.jeweller_name}
                </p>
                <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', lineHeight: 1.3 }}>{p.name}</h2>
                <p style={{ margin: '0 0 0.65rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  Rate <span className="tabular">₹{formatInr(rate, 2)}/g</span> · {p.gold_weight_grams}g · Making{' '}
                  {makingChargesShortLabel(p)}
                  {p.stock_quantity != null ? ` · Max ${max}` : ''}
                </p>
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-faint)',
                    lineHeight: 1.5,
                    padding: '0.5rem 0.65rem',
                    borderRadius: 12,
                    background: 'var(--veil-35)',
                    marginBottom: '0.65rem',
                  }}
                >
                  <Row label="Gold + stone (per piece)" value={`₹${formatInr(unit.goldValue)}`} />
                  <Row label="GST on gold 3% (per piece)" value={`₹${formatInr(unit.gstOnGold, 2)}`} />
                  <Row label="Making (after demo discount, per piece)" value={`₹${formatInr(unit.makingCharges)}`} />
                  <Row label="GST on making 18% (per piece)" value={`₹${formatInr(unit.gstOnMaking, 2)}`} />
                  <Row label="Platform fee (per piece, if any)" value={`₹${formatInr(unit.crossPlatformFee)}`} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem' }}>
                  <span className="tabular" style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                    ₹{formatInr(lineTotal.finalAmount)}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    (₹{formatInr(unit.finalAmount)} × {line.qty})
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '0.25rem 0.55rem', minWidth: 36 }}
                      aria-label="Decrease quantity"
                      onClick={() => onChangeQty(p, line.qty - 1)}
                    >
                      −
                    </button>
                    <span className="tabular" style={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '0.25rem 0.55rem', minWidth: 36 }}
                      aria-label="Increase quantity"
                      disabled={line.qty >= max}
                      onClick={() => onChangeQty(p, line.qty + 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                      onClick={() => onRemoveLine(p.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: 20, maxWidth: 420, marginLeft: 'auto' }}>
        <Row label="Jeweller subtotal" value={`₹${formatInr(computed.jewellerSub)}`} muted />
        <Row label="Cridora platform fees (if any)" value={`₹${formatInr(computed.platform)}`} muted />
        <div style={{ marginTop: '0.65rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-soft)' }}>
          <Row label="Order total" value={<strong>₹{formatInr(computed.final)}</strong>} />
        </div>
        <p style={{ margin: '0.85rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {checkoutRedemptionCopyMulti(lines, computed.platform)}
        </p>
        <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '1.1rem' }} onClick={onProceedToPayment}>
          Proceed to payment
        </button>
      </div>
    </div>
  )
}

export function MarketplaceCartCheckout({
  lines,
  pricingCtx,
  onBack,
}: {
  lines: CartLine[]
  pricingCtx?: CheckoutPricingContext
  onBack: () => void
}) {
  const { user } = useAuth()
  const [payMode, setPayMode] = useState<'cash' | 'vault'>('cash')
  const [vaultGrams, setVaultGrams] = useState(0)
  const [goldWallet, setGoldWallet] = useState<GoldWalletDTO | null>(null)
  const [totalVaultedAllPartners, setTotalVaultedAllPartners] = useState(0)
  const [checkoutStep, setCheckoutStep] = useState<'pay' | 'cash' | 'receipt'>('pay')
  const [receipt, setReceipt] = useState<MarketplaceCheckoutReceipt | null>(null)
  const singleLine = lines.length === 1 && lines[0].qty === 1 ? lines[0] : null

  const jewellerIds = useMemo(() => {
    const s = new Set<number>()
    for (const l of lines) s.add(l.product.jeweller_id)
    return s
  }, [lines])
  const singleJewellerId = jewellerIds.size === 1 ? [...jewellerIds][0] : null
  const vaultAllowed = singleJewellerId != null

  const refreshWallet = useCallback(async () => {
    const w = await fetchGoldWallet()
    if (!w) {
      setGoldWallet(null)
      setTotalVaultedAllPartners(0)
      return
    }
    setGoldWallet(w)
    setTotalVaultedAllPartners(walletBalanceGrams(w))
  }, [])

  useEffect(() => {
    void refreshWallet()
  }, [refreshWallet])

  useLivePoll(refreshWallet, LIVE_BALANCE_POLL_MS, true)

  const eligibleGramsAtSeller = singleJewellerId != null ? vaultCheckoutEligibleGramsAtJeweller(goldWallet, singleJewellerId) : 0
  const maxVaultGrams = eligibleGramsAtSeller

  useEffect(() => {
    setVaultGrams((g) => Math.min(g, maxVaultGrams))
  }, [maxVaultGrams])

  const { sumFinal, lineBreakdowns, jewellerNames } = useMemo(() => {
    let sum = 0
    const lbs: { product: MarketplaceProductDTO; qty: number; bd: PriceBreakdown }[] = []
    const jn = new Set<string>()
    for (const l of lines) {
      const bd = calculateCheckoutPrice(l.product, 0, 0, pricingCtx, l.qty)
      sum += bd.finalAmount
      jn.add(l.product.jeweller_name)
      lbs.push({ product: l.product, qty: l.qty, bd })
    }
    return { sumFinal: sum, lineBreakdowns: lbs, jewellerNames: [...jn].sort() }
  }, [lines, pricingCtx])

  const blendRate = useMemo(() => cartBlendedMetalRateInrPerGram(lines), [lines])

  const cartBreakdown =
    singleLine != null
      ? calculateCheckoutPrice(
          singleLine.product,
          payMode === 'vault' ? vaultGrams : 0,
          eligibleGramsAtSeller,
          pricingCtx,
          singleLine.qty,
        )
      : null
  const payableAmount = cartBreakdown?.payableAmount ?? sumFinal
  const vaultValueOffset = cartBreakdown?.vaultValueOffset ?? 0
  const goldFromVault = cartBreakdown?.goldFromVault ?? 0
  const gstOnGoldSaved = cartBreakdown?.gstOnGoldSaved ?? 0
  const gramsSuggestedFullOrder =
    singleLine != null
      ? suggestedVaultGramsForFullOrder(singleLine.product, eligibleGramsAtSeller, pricingCtx, singleLine.qty)
      : vaultGramsAtListingRateForOrderInr(sumFinal, blendRate)
  const kycOk = user?.kyc_status === 'verified'

  const { busy, error, setError, runConfirm } = useMarketplaceOrderConfirm({
    product: singleLine?.product ?? lines[0].product,
    vaultGrams,
    payMode,
    breakdown: cartBreakdown ?? lineBreakdowns[0].bd,
    onSuccess: (r) => {
      setReceipt(r)
      setCheckoutStep('receipt')
    },
  })

  const onPrimaryPay = () => {
    setError('')
    if (!singleLine) {
      setError('Checkout supports one piece at a time. Remove extra lines or change quantity to 1.')
      return
    }
    if (!kycOk) {
      setError('Complete KYC before checkout.')
      return
    }
    if (payableAmount <= 0 && (payMode === 'vault' ? vaultGrams > 0 : true)) {
      void runConfirm('')
      return
    }
    if (payableAmount > 0) setCheckoutStep('cash')
  }

  const firstName = lines[0]?.product.jeweller_name ?? 'jeweller'

  useEffect(() => {
    if (!vaultAllowed && payMode === 'vault') setPayMode('cash')
  }, [vaultAllowed, payMode])

  if (lines.length === 0) {
    return null
  }

  if (checkoutStep === 'receipt' && receipt) {
    return (
      <div className="container page" style={{ paddingBottom: '4rem' }}>
        <MarketplaceCheckoutReceiptCard receipt={receipt} onDone={onBack} />
      </div>
    )
  }

  return (
    <div className="container page" style={{ paddingBottom: '4rem' }}>
      <button type="button" className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '1.25rem' }}>
        ← Back to cart
      </button>
      <h1 className="h1-page">Payment</h1>
      <p className="lead lead-tight" style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
        Order total <strong className="tabular">₹{formatInr(sumFinal)}</strong>
        {jewellerNames.length > 1 ? (
          <>
            {' '}
            · Items from {jewellerNames.length} jewellers
          </>
        ) : (
          <>
            {' '}
            · {firstName}
          </>
        )}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        <div className="card" style={{ padding: '1.35rem', borderRadius: 22 }}>
          <h2 style={{ margin: '0 0 0.85rem', fontSize: '1rem' }}>Order summary</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            {lineBreakdowns.map(({ product: p, qty, bd }) => (
              <div
                key={p.id}
                style={{
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid var(--border-soft)',
                }}
              >
                <p style={{ margin: 0, fontWeight: 700 }}>{p.name}</p>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {p.jeweller_name} · Qty {qty}
                </p>
                <p style={{ margin: '0.35rem 0 0', fontWeight: 600 }} className="tabular">
                  ₹{formatInr(bd.finalAmount)}
                </p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-soft)' }}>
            <Row label="Due (before vault)" value={`₹${formatInr(sumFinal)}`} />
          </div>
        </div>

        <div className="card" style={{ padding: '1.35rem', borderRadius: 22, position: 'sticky', top: 96 }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>Pay with</h3>

          {!vaultAllowed ? (
            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text)' }}>Vault gold:</strong> available when every item is from the same jeweller.
              Finish separate orders or adjust your cart.
            </p>
          ) : null}

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
                name="pay-mode-cart"
                checked={payMode === 'cash'}
                onChange={() => setPayMode('cash')}
                style={{ marginTop: 3 }}
              />
              <span style={{ fontSize: '0.88rem' }}>
                <strong>Cash / UPI only</strong>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
                  Pay the full order by cash or UPI.
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
                opacity: vaultAllowed ? 1 : 0.5,
              }}
            >
              <input
                type="radio"
                name="pay-mode-cart"
                checked={payMode === 'vault'}
                disabled={!vaultAllowed}
                onChange={() => setPayMode('vault')}
                style={{ marginTop: 3 }}
              />
              <span style={{ fontSize: '0.88rem' }}>
                <strong>Cridora account (gold)</strong>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
                  {vaultAllowed ? (
                    <>
                      <strong>Blended vault rate:</strong> ₹{formatInr(blendRate, 2)}/g · <strong>Suggested for full order:</strong>{' '}
                      <span className="tabular">{gramsSuggestedFullOrder.toFixed(3)}g</span>. You hold{' '}
                      <span className="tabular">{eligibleGramsAtSeller.toFixed(3)}g</span> with {firstName}. Total vaulted (all
                      partners): <span className="tabular">{totalVaultedAllPartners.toFixed(3)}g</span>.
                    </>
                  ) : (
                    <>Add items from one jeweller to pay with vaulted gold.</>
                  )}
                </span>
              </span>
            </label>
          </div>

          {payMode === 'vault' && vaultAllowed ? (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', borderRadius: 12 }}
                  onClick={() => setVaultGrams(Math.min(maxVaultGrams, gramsSuggestedFullOrder))}
                  disabled={maxVaultGrams <= 0 || !Number.isFinite(gramsSuggestedFullOrder)}
                >
                  Use suggested — full order in gold
                </button>
              </div>
              <label htmlFor="vault-grams-cart" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Grams (0 – {maxVaultGrams.toFixed(3)})
              </label>
              <input
                id="vault-grams-cart"
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
            </div>
          ) : null}

          <div
            style={{
              padding: '1rem',
              borderRadius: 16,
              border: payMode === 'vault' && vaultGrams > 0 ? '2px solid var(--gold)' : '1px solid var(--border-soft)',
              background: payMode === 'vault' && vaultGrams > 0 ? 'var(--gold-shine-12)' : 'var(--veil-35)',
              marginBottom: '1rem',
            }}
          >
            {payMode === 'vault' && vaultAllowed && vaultGrams > 0 ? (
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Row label="Vault metal credit" value={<strong style={{ color: 'var(--success)' }}>₹{formatInr(cartBreakdown?.vaultMetalCredit ?? vaultValueOffset)}</strong>} muted />
                {gstOnGoldSaved > 0 ? (
                  <Row label="GST on gold (vault relief)" value={<strong style={{ color: 'var(--success)' }}>-₹{formatInr(gstOnGoldSaved)}</strong>} muted />
                ) : null}
                <Row label="Grams debited" value={<strong className="tabular">{goldFromVault.toFixed(3)}g</strong>} muted />
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {payMode === 'vault' && vaultAllowed
                  ? 'Move the slider to apply gold from your Cridora account.'
                  : 'Pay the order total with cash or UPI.'}
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
              {payMode === 'vault' && vaultGrams > 0 ? 'Remaining (cash / UPI)' : 'Due now (cash / UPI)'}
            </p>
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }} className="tabular">
              ₹{formatInr(payableAmount)}
            </p>
          </div>

          {checkoutStep === 'cash' && singleLine ? (
            <MarketplaceCashPayStep
              amountInr={payableAmount}
              jewellerName={singleLine.product.jeweller_name}
              busy={busy}
              error={error}
              onBack={() => setCheckoutStep('pay')}
              onPaid={(method) => void runConfirm(method)}
            />
          ) : (
            <>
              {error ? (
                <p className="form-error" role="alert" style={{ marginBottom: '0.75rem' }}>
                  {error}
                </p>
              ) : null}
              {!singleLine ? (
                <p className="form-footnote" style={{ marginBottom: '0.75rem' }}>
                  One piece per checkout (qty 1, single SKU). Adjust your cart or buy from the product page.
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
                  : payableAmount <= 0 && payMode === 'vault' && vaultGrams > 0
                    ? 'Confirm — vault covers this order'
                    : payableAmount <= 0
                      ? 'Confirm payment'
                      : payMode === 'vault' && vaultGrams > 0
                        ? `Pay ₹${formatInr(payableAmount)} cash + vault`
                        : `Pay ₹${formatInr(payableAmount)} with cash / UPI`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
