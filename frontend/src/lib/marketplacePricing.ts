import type { MarketplaceProductDTO } from '@/lib/marketplaceApi'

export type PriceBreakdown = {
  goldValue: number
  makingCharges: number
  gstOnGold: number
  gstOnMaking: number
  jewellerSubtotal: number
  crossPlatformFee: number
  finalAmount: number
  vaultValueOffset: number
  payableAmount: number
  goldFromVault: number
  discountAmount: number
}

export const USER_VAULT_BALANCE = 12.45
/** Fallback when API omits `cross_platform_fee_inr` (legacy clients). */
export const DEFAULT_CROSS_PLATFORM_FEE_INR = 49
export const MAKING_FIXED_PER_GRAM = 'fixed_per_gram'
export const MAKING_PERCENT_OF_METAL = 'percent_of_metal'

const DISCOUNT_RATE = 0.05

type JewellerParts = {
  goldValue: number
  makingCharges: number
  gstOnGold: number
  gstOnMaking: number
  discountAmount: number
  jewellerSubtotal: number
}

function rawMakingChargesInr(p: MarketplaceProductDTO): number {
  const mode = p.making_charge_mode?.trim() || MAKING_FIXED_PER_GRAM
  const weight = Number.parseFloat(p.gold_weight_grams)
  if (mode === MAKING_PERCENT_OF_METAL) {
    const pct = Number.parseFloat(p.making_charge_percent || '0')
    const goldMetal = Number.parseFloat(p.gold_metal_value_inr)
    return goldMetal * (pct / 100)
  }
  const makingPerG = Number.parseFloat(p.making_charge_per_gram)
  return weight * makingPerG
}

/** Short text for subtitles and compact UI (e.g. "8.5% of metal" or "₹650/g"). */
export function makingChargesShortLabel(p: MarketplaceProductDTO): string {
  const mode = p.making_charge_mode?.trim() || MAKING_FIXED_PER_GRAM
  if (mode === MAKING_PERCENT_OF_METAL) {
    const pct = Number.parseFloat(p.making_charge_percent || '0')
    const s = pct.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    return `${s}% of metal`
  }
  const pg = Number.parseFloat(p.making_charge_per_gram)
  return `₹${pg.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/g`
}

/** Longer label for price breakdown rows on product cards. */
export function makingChargesBreakdownLabel(p: MarketplaceProductDTO): string {
  const mode = p.making_charge_mode?.trim() || MAKING_FIXED_PER_GRAM
  if (mode === MAKING_PERCENT_OF_METAL) {
    const pct = Number.parseFloat(p.making_charge_percent || '0')
    const s = pct.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    return `Making (${s}% of gold metal)`
  }
  const pg = Number.parseFloat(p.making_charge_per_gram)
  const w = Number.parseFloat(p.gold_weight_grams)
  const pgS = pg.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  const wS = w.toLocaleString('en-IN', { maximumFractionDigits: 3 })
  return `Making (₹${pgS}/g × ${wS}g)`
}

function jewellerLineParts(p: MarketplaceProductDTO): JewellerParts {
  const goldValue = Number.parseFloat(p.gold_plus_stone_inr)
  const rawMakingCharges = rawMakingChargesInr(p)
  const discountAmount = rawMakingCharges * DISCOUNT_RATE
  const makingCharges = rawMakingCharges - discountAmount
  const gstOnGold = goldValue * 0.03
  const gstOnMaking = makingCharges * 0.18
  const jewellerSubtotal = goldValue + makingCharges + gstOnGold + gstOnMaking

  return {
    goldValue,
    makingCharges,
    gstOnGold,
    gstOnMaking,
    discountAmount,
    jewellerSubtotal,
  }
}

/** Jeweller invoice subtotal only (no Cridora platform fee). For sorting / catalogue context. */
export function jewellerSubtotalInr(p: MarketplaceProductDTO): number {
  return jewellerLineParts(p).jewellerSubtotal
}

/** Cridora cross-network fee; jewellers do not charge this. Shown at checkout only. */
export function cridoraCrossPlatformFeeInr(p: MarketplaceProductDTO): number {
  if (!p.is_x_redeem) return 0
  const raw = p.cross_platform_fee_inr
  if (raw != null && raw !== '') {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return DEFAULT_CROSS_PLATFORM_FEE_INR
}

/** Demo vault balance is enough to apply vault grams equal to the piece’s gold weight. */
export function vaultCanCoverFullGoldWeight(p: MarketplaceProductDTO): boolean {
  const w = Number.parseFloat(p.gold_weight_grams)
  return w > 0 && USER_VAULT_BALANCE + 1e-9 >= w
}

export function calculateCheckoutPrice(
  p: MarketplaceProductDTO,
  vaultGramsToApply: number,
  vaultBalanceGrams: number,
): PriceBreakdown {
  const j = jewellerLineParts(p)
  const crossPlatformFee = cridoraCrossPlatformFeeInr(p)
  const finalAmount = j.jewellerSubtotal + crossPlatformFee
  const metalRate = Number.parseFloat(p.metal_rate_inr_per_gram_used)
  const weight = Number.parseFloat(p.gold_weight_grams)
  const cappedGrams = Math.max(0, Math.min(vaultGramsToApply, vaultBalanceGrams, weight))
  const vaultValueOffset = cappedGrams * metalRate
  const payableAmount = Math.max(0, finalAmount - vaultValueOffset)

  return {
    goldValue: j.goldValue,
    makingCharges: j.makingCharges,
    gstOnGold: j.gstOnGold,
    gstOnMaking: j.gstOnMaking,
    jewellerSubtotal: j.jewellerSubtotal,
    crossPlatformFee,
    finalAmount,
    vaultValueOffset,
    payableAmount,
    goldFromVault: cappedGrams,
    discountAmount: j.discountAmount,
  }
}
