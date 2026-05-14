import type { MarketplaceProductDTO } from '@/lib/marketplaceApi'
import {
  makingChargesBreakdownLabel,
  USER_VAULT_BALANCE,
  calculateCheckoutPrice,
  vaultCanCoverFullGoldWeight,
} from '@/lib/marketplacePricing'

export function formatInr(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

export function formatJewellerMetalRateAsOf(iso: string | undefined): string | null {
  if (!iso?.trim()) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso.trim()
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
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

export function hasStoneOrOtherMetal(p: MarketplaceProductDTO): boolean {
  if (p.stone_included) return true
  const comp = Number.parseFloat(p.stone_component_inr)
  return Number.isFinite(comp) && comp > 0
}

/** Grid / list — name, grams, final all-in price only (caller renders title). */
export function MarketplaceProductListSummary({ p }: { p: MarketplaceProductDTO }) {
  const weightG = Number.parseFloat(p.gold_weight_grams)
  const final = calculateCheckoutPrice(p, 0, USER_VAULT_BALANCE).finalAmount

  return (
    <div>
      <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }} className="tabular">
        <strong style={{ color: 'var(--text)' }}>{formatInr(weightG, 3)} g</strong>
        <span style={{ color: 'var(--text-faint)' }}> · 22K gold</span>
      </p>
      <p
        style={{
          margin: '0.45rem 0 0',
          fontSize: '0.62rem',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        Final incl. taxes
      </p>
      <p style={{ margin: '0.2rem 0 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold-light)' }} className="tabular">
        ₹{formatInr(final)}
      </p>
    </div>
  )
}

export function MarketplaceProductPricingBreakdown({ p }: { p: MarketplaceProductDTO }) {
  const weightG = Number.parseFloat(p.gold_weight_grams)
  const metalRate = Number.parseFloat(p.metal_rate_inr_per_gram_used)
  const rateTimesG = metalRate * weightG
  const base = calculateCheckoutPrice(p, 0, USER_VAULT_BALANCE)
  const vaultEst = calculateCheckoutPrice(p, Math.min(weightG, USER_VAULT_BALANCE), USER_VAULT_BALANCE)
  const fullGoldVaultMatch = vaultCanCoverFullGoldWeight(p) && vaultEst.goldFromVault + 1e-9 >= weightG
  const goldMetal = Number.parseFloat(p.gold_metal_value_inr)
  const stoneComp = Number.parseFloat(p.stone_component_inr)
  const showMetalSplit = hasStoneOrOtherMetal(p)
  const rateAsOf = formatJewellerMetalRateAsOf(p.jeweller_metal_rate_last_updated_at)

  return (
    <div
      style={{
        padding: '0.65rem',
        borderRadius: 14,
        background: 'var(--veil-25)',
        border: '1px solid var(--border-soft)',
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
        Price breakdown (estimate)
      </p>
      <CardPriceRow label="Metal rate / gram (this jeweller)" value={`₹${formatInr(metalRate, 2)}/g`} />
      {rateAsOf ? <CardPriceRow label="Jeweller rate updated" value={rateAsOf} /> : null}
      <CardPriceRow label="Gold weight" value={`${formatInr(weightG, 3)} g`} />
      <CardPriceRow label="Metal line (rate × g)" value={`₹${formatInr(Math.round(rateTimesG))}`} />
      {showMetalSplit && goldMetal > 0 ? (
        <CardPriceRow label="— Gold metal value" value={`₹${formatInr(goldMetal)}`} />
      ) : null}
      {showMetalSplit && stoneComp > 0 ? (
        <CardPriceRow label="— Stone / other value" value={`₹${formatInr(stoneComp)}`} />
      ) : null}
      <CardPriceRow label="GST on metal (3%)" value={`₹${formatInr(base.gstOnGold, 2)}`} />
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
        <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Total (incl. taxes)</span>
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
          With vault (up to {vaultEst.goldFromVault.toFixed(3)}g)
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
          ? 'If vault grams match this piece’s gold weight, cash is mainly making + GST on making, plus other bill lines.'
          : 'Demo vault may be smaller than this piece — adjust grams at checkout.'}
      </p>
    </div>
  )
}
