import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  fetchMarketplaceProducts,
  fetchVerifiedJewellers,
  type MarketplaceProductDTO,
  type JewellerStorefrontDTO,
} from '@/lib/marketplaceApi'
import {
  calculateCheckoutPrice,
  jewellerSubtotalInr,
  makingChargesBreakdownLabel,
  makingChargesShortLabel,
  USER_VAULT_BALANCE,
  vaultCanCoverFullGoldWeight,
  type PriceBreakdown,
} from '@/lib/marketplacePricing'

function formatInr(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

function CardPriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '0.5rem',
        fontSize: '0.68rem',
        lineHeight: 1.35,
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="tabular" style={{ fontWeight: 600, color: 'var(--text)', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}

function hasStoneOrOtherMetal(p: MarketplaceProductDTO): boolean {
  if (p.stone_included) return true
  const comp = Number.parseFloat(p.stone_component_inr)
  return Number.isFinite(comp) && comp > 0
}

function MarketplaceProductCardPricing({ p }: { p: MarketplaceProductDTO }) {
  const weightG = Number.parseFloat(p.gold_weight_grams)
  const metalRate = Number.parseFloat(p.metal_rate_inr_per_gram_used)
  const rateTimesG = metalRate * weightG
  const base = calculateCheckoutPrice(p, 0, USER_VAULT_BALANCE)
  const vaultEst = calculateCheckoutPrice(p, Math.min(weightG, USER_VAULT_BALANCE), USER_VAULT_BALANCE)
  const fullGoldVaultMatch = vaultCanCoverFullGoldWeight(p) && vaultEst.goldFromVault + 1e-9 >= weightG
  const goldMetal = Number.parseFloat(p.gold_metal_value_inr)
  const stoneComp = Number.parseFloat(p.stone_component_inr)
  const showMetalSplit = hasStoneOrOtherMetal(p)

  return (
    <div
      style={{
        padding: '0.65rem',
        borderRadius: 14,
        background: 'var(--veil-25)',
        border: '1px solid var(--border-soft)',
        marginBottom: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '0.58rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        Pricing (estimate)
      </p>
      <CardPriceRow label="Rate / gram" value={`₹${formatInr(metalRate, 2)}/g`} />
      <CardPriceRow label="Total grams (gold)" value={`${formatInr(weightG, 3)}g`} />
      <CardPriceRow label="Total rate (rate × g)" value={`₹${formatInr(Math.round(rateTimesG))}`} />
      {showMetalSplit && goldMetal > 0 ? (
        <CardPriceRow label="— Gold metal value" value={`₹${formatInr(goldMetal)}`} />
      ) : null}
      {showMetalSplit && stoneComp > 0 ? (
        <CardPriceRow label="— Stone / other value" value={`₹${formatInr(stoneComp)}`} />
      ) : null}
      <CardPriceRow label="GST on metal layer (3%)" value={`₹${formatInr(base.gstOnGold, 2)}`} />
      <CardPriceRow label={makingChargesBreakdownLabel(p)} value={`₹${formatInr(base.makingCharges)}`} />
      <CardPriceRow label="GST on making (18%)" value={`₹${formatInr(base.gstOnMaking, 2)}`} />
      <div style={{ height: 1, background: 'var(--border-soft)', margin: '0.15rem 0' }} />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '0.5rem',
          fontSize: '0.72rem',
          lineHeight: 1.35,
          padding: '0.35rem 0',
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Final purchase (incl. taxes)</span>
        <span
          className="tabular"
          style={{
            fontWeight: 800,
            fontSize: '0.82rem',
            color: 'var(--gold-light)',
            textAlign: 'right',
            textShadow: '0 0 24px rgba(212, 168, 75, 0.25)',
          }}
        >
          ₹{formatInr(base.finalAmount)}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '0.5rem',
          fontSize: '0.68rem',
          lineHeight: 1.35,
          padding: '0.25rem 0 0.35rem',
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
          Price with vault (up to {vaultEst.goldFromVault.toFixed(3)}g)
        </span>
        <span
          className="tabular"
          style={{
            fontWeight: 800,
            fontSize: '0.78rem',
            color: 'var(--success)',
            textAlign: 'right',
          }}
        >
          ₹{formatInr(vaultEst.payableAmount)}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {fullGoldVaultMatch
          ? 'If vault grams match this piece’s gold weight, cash is mainly making + GST on making (after same‑store MC discounts), plus other bill lines.'
          : 'Demo vault is smaller than this piece — choose grams at checkout; cash covers the rest after vault credit.'}
      </p>
    </div>
  )
}

function checkoutRedemptionCopy(p: MarketplaceProductDTO, cridoraFee: number): string {
  if (p.is_x_redeem && cridoraFee > 0) {
    return `Cross-jeweller settlement: Cridora adds a platform fee of ₹${formatInr(cridoraFee)} on this order. The jeweller does not charge this fee.`
  }
  if (p.is_x_redeem) {
    return 'Network redemption listing. Platform fees, if any, are set by Cridora at checkout—not by the jeweller.'
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

function ProductPhoto({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [ok, setOk] = useState(true)
  if (!ok) {
    return (
      <div className="media-frame__fallback" role="img" aria-label={alt ? `${alt} unavailable` : 'Image unavailable'}>
        Image unavailable
      </div>
    )
  }
  const imgClass = className.trim() ? `media-fill ${className}` : 'media-fill'
  return (
    <img
      src={src}
      alt={alt}
      className={imgClass}
      loading="lazy"
      decoding="async"
      onError={() => setOk(false)}
    />
  )
}

function CheckoutView({
  product,
  onBack,
}: {
  product: MarketplaceProductDTO
  onBack: () => void
}) {
  const weight = Number.parseFloat(product.gold_weight_grams)
  const maxVaultGrams = Math.min(weight, USER_VAULT_BALANCE)
  const [payMode, setPayMode] = useState<'cash' | 'vault'>('cash')
  const [vaultGrams, setVaultGrams] = useState(0)

  const p: PriceBreakdown = useMemo(
    () => calculateCheckoutPrice(product, payMode === 'vault' ? vaultGrams : 0, USER_VAULT_BALANCE),
    [product, payMode, vaultGrams],
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
        platform fee (never charged by the jeweller). Choose cash / UPI or your Cridora account; with the account you can
        apply part of your gold balance and pay the rest in cash. Demo vault balance {USER_VAULT_BALANCE.toFixed(3)}g at
        ₹{formatInr(Number.parseFloat(product.metal_rate_inr_per_gram_used), 2)}/g credit. Sellback notes are storefront
        disclosures only.
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
                {product.gold_weight_grams}g · BIS 916 · Making {makingChargesShortLabel(product)}
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
                  Choose how many grams to apply; the rest is paid in cash / UPI. Available {USER_VAULT_BALANCE.toFixed(3)}g
                  (max {maxVaultGrams.toFixed(3)}g on this piece).
                </span>
              </span>
            </label>
          </div>

          {vaultActive ? (
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="vault-grams" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Grams from Cridora account (0 – {maxVaultGrams.toFixed(3)})
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
            </div>
          ) : null}

          <div
            style={{
              padding: '1rem',
              borderRadius: 16,
              border: vaultActive && p.goldFromVault > 0 ? '2px solid var(--gold)' : '1px solid var(--border-soft)',
              background: vaultActive && p.goldFromVault > 0 ? 'var(--gold-shine-12)' : 'var(--veil-35)',
              marginBottom: '1rem',
            }}
          >
            {vaultActive && p.goldFromVault > 0 ? (
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
                <Row label="Vault grams applied" value={<strong>{p.goldFromVault.toFixed(3)}g</strong>} muted />
                <Row
                  label="Credit toward order"
                  value={<strong style={{ color: 'var(--success)' }}>₹{formatInr(p.vaultValueOffset)}</strong>}
                  muted
                />
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
              {vaultActive && p.goldFromVault > 0 ? 'Remaining (cash / UPI)' : 'Due now (cash / UPI)'}
            </p>
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }} className="tabular">
              ₹{formatInr(payDisplay)}
            </p>
          </div>

          <button type="button" className="btn btn-primary" style={{ width: '100%' }}>
            {payDisplay <= 0 && vaultActive && p.goldFromVault > 0
              ? 'Confirm — vault covers this order'
              : payDisplay <= 0
                ? 'Confirm payment'
                : vaultActive && p.goldFromVault > 0
                  ? `Pay ₹${formatInr(payDisplay)} cash + vault`
                  : `Pay ₹${formatInr(payDisplay)} with cash / UPI`}
          </button>

          <p className="form-footnote" style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.72rem' }}>
            Demo checkout · piece {weight.toFixed(3)}g
            {vaultActive ? ` · vault debit ${p.goldFromVault.toFixed(3)}g on confirm` : ''}
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

function QuickViewModal({
  product,
  onClose,
  onCheckout,
}: {
  product: MarketplaceProductDTO
  onClose: () => void
  onCheckout: (p: MarketplaceProductDTO) => void
}) {
  const metalRate = Number.parseFloat(product.metal_rate_inr_per_gram_used)
  const stoneCompVal = Number.parseFloat(product.stone_component_inr)
  const showStone = hasStoneOrOtherMetal(product)
  const qvTotals = calculateCheckoutPrice(product, 0, USER_VAULT_BALANCE)
  const weightQv = Number.parseFloat(product.gold_weight_grams)
  const qvVault = calculateCheckoutPrice(product, Math.min(weightQv, USER_VAULT_BALANCE), USER_VAULT_BALANCE)
  const qvFullGoldVaultMatch = vaultCanCoverFullGoldWeight(product) && qvVault.goldFromVault + 1e-9 >= weightQv

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mp-quick-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          border: 'none',
          background: 'var(--veil-82)',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
        }}
      />
      <div
        className="card"
        style={{
          position: 'relative',
          maxWidth: 920,
          width: '100%',
          maxHeight: 'min(92vh, 900px)',
          borderRadius: 24,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 4,
            width: 40,
            height: 40,
            minWidth: 40,
            padding: 0,
            borderRadius: '50%',
            fontSize: '1.15rem',
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <div
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            minHeight: 0,
            paddingTop: '2.75rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            alignItems: 'stretch',
          }}
        >
        <div
          style={{
            padding: '0 1.5rem 1.5rem',
            background: 'var(--gradient-modal-aside)',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          <div className="media-frame media-frame--modal-product">
            <ProductPhoto src={product.image_url} alt="" />
          </div>
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
          </p>
          <h2
            id="mp-quick-title"
            style={{
              margin: '0 0 0.35rem',
              fontSize: '1.2rem',
              lineHeight: 1.3,
              wordBreak: 'break-word',
            }}
          >
            {product.name}
          </h2>
          <p
            style={{
              margin: '0 0 1rem',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              lineHeight: 1.45,
              wordBreak: 'break-word',
            }}
          >
            {product.category ? `${product.category} · ` : ''}BIS 916 · Gold rate ₹{formatInr(metalRate, 2)}/g · Making{' '}
            {makingChargesShortLabel(product)}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            <div className="card" style={{ padding: '0.75rem', textAlign: 'center', borderRadius: 14, margin: 0 }}>
              <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--text-faint)', fontWeight: 800 }}>Weight</p>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 800 }}>{product.gold_weight_grams}g</p>
            </div>
            <div className="card" style={{ padding: '0.75rem', textAlign: 'center', borderRadius: 14, margin: 0 }}>
              <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--text-faint)', fontWeight: 800 }}>Purity</p>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 800, color: 'var(--gold-light)' }}>BIS 916</p>
            </div>
            <div className="card" style={{ padding: '0.75rem', textAlign: 'center', borderRadius: 14, margin: 0 }}>
              <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--text-faint)', fontWeight: 800 }}>Making</p>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 800, fontSize: '0.78rem', lineHeight: 1.3 }} className="tabular">
                {makingChargesShortLabel(product)}
              </p>
            </div>
            <div className="card" style={{ padding: '0.75rem', textAlign: 'center', borderRadius: 14, margin: 0 }}>
              <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--text-faint)', fontWeight: 800 }}>Gold rate</p>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 800 }} className="tabular">
                ₹{formatInr(metalRate, 2)}/g
              </p>
            </div>
          </div>
          {showStone ? (
            <p style={{ marginTop: '0.85rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45, wordBreak: 'break-word' }}>
              <strong style={{ color: 'var(--text)' }}>Stone / other:</strong>{' '}
              {product.stone_included ? product.stone_type || 'Included' : 'Component in quote'}
              {(product.stone_weight_grams ?? '').toString().trim() !== ''
                ? ` · ${product.stone_weight_grams}g`
                : ''}
              {(product.stone_cost_inr ?? '').toString().trim() !== ''
                ? ` · ₹${product.stone_cost_inr}`
                : stoneCompVal > 0
                  ? ` · ₹${formatInr(stoneCompVal)}`
                  : ''}
            </p>
          ) : null}
          <p style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.76rem', lineHeight: 1.45, color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text)' }}>Checkout:</strong> pay with cash / UPI or your Cridora account — full
            breakdown on the next step.
          </p>
        </div>
        <div
          style={{
            padding: '0 1.5rem 1.5rem',
            background: 'var(--veil-55)',
            minWidth: 0,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>At checkout</h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Final amount includes metal, making, and GST. Adjust vault grams on the payment page.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem', marginBottom: '1rem' }}>
            <Row label="Gold rate (this listing)" value={`₹${formatInr(metalRate, 2)}/g`} />
            <Row label="Making" value={makingChargesShortLabel(product)} />
            <Row label="Weight" value={`${product.gold_weight_grams}g`} />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.75rem',
              marginBottom: '1rem',
              padding: '0.75rem 0',
              borderTop: '1px solid var(--border-soft)',
              borderBottom: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.88rem' }}>Est. final (incl. taxes)</span>
            <span
              className="tabular"
              style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--gold-light)' }}
            >
              ₹{formatInr(qvTotals.finalAmount)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.75rem',
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.82rem' }}>
              Price with vault ({qvVault.goldFromVault.toFixed(3)}g)
            </span>
            <span className="tabular" style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--success)' }}>
              ₹{formatInr(qvVault.payableAmount)}
            </span>
          </div>
          <p style={{ margin: '0.65rem 0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            {qvFullGoldVaultMatch
              ? 'When vault grams match gold weight, cash is mostly making + GST on making (same‑store MC discounts apply), plus other bill lines.'
              : 'Partial vault in this demo; at checkout you choose grams and pay the balance in cash / UPI.'}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'auto' }}
            onClick={() => onCheckout(product)}
          >
            Go to checkout
          </button>
        </div>
        </div>
      </div>
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
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProductDTO | null>(null)
  const [checkoutProduct, setCheckoutProduct] = useState<MarketplaceProductDTO | null>(null)
  const [catalog, setCatalog] = useState<MarketplaceProductDTO[]>([])
  const [loadError, setLoadError] = useState('')
  const [liveRateLabel, setLiveRateLabel] = useState('')
  const [cartQtyById, setCartQtyById] = useState<Record<number, number>>({})

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
    const rows = await fetchMarketplaceProducts({
      category: activeCategory,
      jewellerId: jewellerFilterId,
    })
    setCatalog(rows)
    const first = rows[0]
    if (first) {
      setLiveRateLabel(first.platform_base_inr_per_gram_22k)
    }
  }, [activeCategory, jewellerFilterId])

  useEffect(() => {
    void refreshCatalog()
  }, [refreshCatalog])

  useEffect(() => {
    let cancel = false
    void fetchVerifiedJewellers().then((list) => {
      if (!cancel) setJewellerOptions(list)
    })
    return () => {
      cancel = true
    }
  }, [])

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
    const sortPrice = (p: MarketplaceProductDTO) => jewellerSubtotalInr(p)
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

  const openCheckout = (p: MarketplaceProductDTO) => {
    setSelectedProduct(null)
    setCheckoutProduct(p)
  }

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
    return <CheckoutView product={checkoutProduct} onBack={() => setCheckoutProduct(null)} />
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
          <span className="pill">Phase 1 · BIS 916 · jeweller storefronts</span>
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
            Ornaments, chains, bangles, coins, and bridal sets from verified jewellers. Each card shows rate, weights, metal
            and making taxes, Cridora platform fee when applicable, and a vault-at-checkout estimate.{' '}
            <Link to="/jewellers" style={{ color: 'var(--gold-light)' }}>
              Compare jewellers
            </Link>{' '}
            for sellback, lock-in, and same-store benefits.
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
              onClick={() => void refreshCatalog()}
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
                Vault balance
              </p>
              <p style={{ margin: '0.2rem 0 0', fontWeight: 800 }} className="tabular">
                {USER_VAULT_BALANCE.toFixed(3)}g
              </p>
            </div>
            <div
              className="card"
              style={{
                margin: 0,
                padding: '0.65rem 0.85rem',
                borderRadius: 14,
                minWidth: 160,
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
                Platform 22K base
              </p>
              <p style={{ margin: '0.2rem 0 0', fontWeight: 800, color: 'var(--success)' }} className="tabular">
                ₹{liveRateLabel ? formatInr(Number.parseFloat(liveRateLabel), 2) : '—'}/g
              </p>
            </div>
          </div>
        </div>

        {sortedProducts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            No approved listings yet. Jewellers submit SKUs from their dashboard; admins approve under Marketplace → Product
            approval (Phase 1 gate).
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {sortedProducts.map((p, idx) => {
              const stoneCompVal = Number.parseFloat(p.stone_component_inr)
              const showStoneDetails = hasStoneOrOtherMetal(p)
              return (
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
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(p)}
                      className="media-frame__hit"
                      aria-label={`View details for ${p.name}`}
                    >
                      <ProductPhoto src={p.image_url} alt="" />
                    </button>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'var(--gradient-image-fade)',
                        pointerEvents: 'none',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 10,
                        right: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'var(--veil-50)',
                        border: '1px solid var(--border-soft)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 8,
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: 'var(--gold-light)',
                      }}
                    >
                      ★ {p.rating}
                    </div>
                  </div>
                  <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <p
                      style={{
                        margin: '0 0 0.35rem',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--text-faint)',
                      }}
                    >
                      <Link
                        to={`/jewellers/${p.jeweller_id}`}
                        style={{ color: 'var(--gold-light)', textDecoration: 'none' }}
                      >
                        {p.jeweller_name}
                      </Link>
                      {p.jeweller_city ? ` · ${p.jeweller_city}` : ''}
                    </p>
                    <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', lineHeight: 1.25 }}>{p.name}</h2>
                    <p style={{ margin: '0 0 0.65rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {p.category}
                      {p.category ? ' · ' : null}
                      BIS 916 (22K) · Phase 1 catalogue
                    </p>
                    {showStoneDetails ? (
                      <p style={{ margin: '0 0 0.65rem', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                        <strong style={{ color: 'var(--text)' }}>Stone / other:</strong>{' '}
                        {p.stone_included ? p.stone_type || 'Included' : 'Component in quote'}
                        {(p.stone_weight_grams ?? '').toString().trim() !== ''
                          ? ` · ${p.stone_weight_grams}g`
                          : ''}
                        {(p.stone_cost_inr ?? '').toString().trim() !== ''
                          ? ` · ₹${p.stone_cost_inr}`
                          : stoneCompVal > 0
                            ? ` · ₹${formatInr(stoneCompVal)}`
                            : ''}
                      </p>
                    ) : null}
                    <MarketplaceProductCardPricing p={p} />
                    {(p.same_store_benefit_note ?? '').trim() ? (
                      <div
                        style={{
                          padding: '0.65rem',
                          borderRadius: 14,
                          border: '1px solid var(--border-soft)',
                          background: 'var(--veil-25)',
                          marginBottom: '0.85rem',
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.45,
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 0.35rem',
                            fontSize: '0.58rem',
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'var(--text-faint)',
                          }}
                        >
                          Jeweller note
                        </p>
                        <p style={{ margin: 0 }}>{p.same_store_benefit_note}</p>
                      </div>
                    ) : null}
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
                      <button type="button" className="btn btn-primary" style={{ padding: '0.5rem 0.65rem' }} onClick={() => openCheckout(p)}>
                        Buy now
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '0.5rem 0.65rem', gridColumn: '1 / -1' }}
                        onClick={() => setSelectedProduct(p)}
                      >
                        Quick view
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
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
            Pricing pulls from `/api/v1/marketplace/products/` after jeweller submission and admin approval. Sellback lines are
            storefront disclosures; settlement rails remain governed by your vault ledger and jeweller agreements.
          </p>
        </aside>

        <p style={{ marginTop: '2rem' }}>
          <Link to="/signup" className="btn btn-primary">
            Get started as a customer
          </Link>
        </p>
      </div>

      {selectedProduct ? (
        <QuickViewModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onCheckout={openCheckout} />
      ) : null}
    </div>
  )
}
