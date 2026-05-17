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

/** Fallback when API omits `cross_platform_fee_inr` (legacy clients). */
export const DEFAULT_CROSS_PLATFORM_FEE_INR = 49
export const MAKING_FIXED_PER_GRAM = 'fixed_per_gram'
export const MAKING_PERCENT_OF_METAL = 'percent_of_metal'

const DISCOUNT_RATE = 0.05

/** When `customerDefaultJewellerId` equals the product listing jeweller, same-store making applies if configured. */
export type CheckoutPricingContext = {
  customerDefaultJewellerId?: number | null
  /** Custodian jewellers where the customer holds vaulted gold; waives Cridora cross-purchase fee for those listings. */
  holdingsJewellerIds?: ReadonlySet<number>
}

type JewellerParts = {
  goldValue: number
  makingCharges: number
  gstOnGold: number
  gstOnMaking: number
  discountAmount: number
  jewellerSubtotal: number
}

function isSameStoreJeweller(p: MarketplaceProductDTO, ctx?: CheckoutPricingContext): boolean {
  const id = ctx?.customerDefaultJewellerId
  return id != null && id === p.jeweller_id
}

function effectiveMakingPercent(p: MarketplaceProductDTO, ctx?: CheckoutPricingContext): number {
  const cross = Number.parseFloat(p.making_charge_percent || '0')
  if (!isSameStoreJeweller(p, ctx)) return cross
  const raw = p.same_store_making_charge_percent
  if (raw == null || String(raw).trim() === '') return cross
  const v = Number.parseFloat(String(raw))
  return Number.isFinite(v) ? v : cross
}

function effectiveMakingPerGram(p: MarketplaceProductDTO, ctx?: CheckoutPricingContext): number {
  const cross = Number.parseFloat(p.making_charge_per_gram || '0')
  if (!isSameStoreJeweller(p, ctx)) return cross
  const raw = p.same_store_making_charge_per_gram
  if (raw == null || String(raw).trim() === '') return cross
  const v = Number.parseFloat(String(raw))
  return Number.isFinite(v) ? v : cross
}

function rawMakingChargesInr(p: MarketplaceProductDTO, ctx?: CheckoutPricingContext): number {
  const mode = p.making_charge_mode?.trim() || MAKING_FIXED_PER_GRAM
  const weight = Number.parseFloat(p.gold_weight_grams)
  if (mode === MAKING_PERCENT_OF_METAL) {
    const pct = effectiveMakingPercent(p, ctx)
    const goldMetal = Number.parseFloat(p.gold_metal_value_inr)
    return goldMetal * (pct / 100)
  }
  const makingPerG = effectiveMakingPerGram(p, ctx)
  return weight * makingPerG
}

/** Short text for subtitles and compact UI (e.g. cross vs same-shop rates). */
export function makingChargesShortLabel(p: MarketplaceProductDTO): string {
  const mode = p.making_charge_mode?.trim() || MAKING_FIXED_PER_GRAM
  if (mode === MAKING_PERCENT_OF_METAL) {
    const cross = Number.parseFloat(p.making_charge_percent || '0')
    const crossS = cross.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    const raw = p.same_store_making_charge_percent
    if (raw != null && String(raw).trim() !== '') {
      const same = Number.parseFloat(String(raw))
      if (Number.isFinite(same)) {
        const sameS = same.toLocaleString('en-IN', { maximumFractionDigits: 2 })
        return `cross ${crossS}% · same shop ${sameS}% metal`
      }
    }
    return `${crossS}% of metal`
  }
  const crossPg = Number.parseFloat(p.making_charge_per_gram || '0')
  const raw = p.same_store_making_charge_per_gram
  if (raw != null && String(raw).trim() !== '') {
    const samePg = Number.parseFloat(String(raw))
    if (Number.isFinite(samePg)) {
      const c = crossPg.toLocaleString('en-IN', { maximumFractionDigits: 0 })
      const s = samePg.toLocaleString('en-IN', { maximumFractionDigits: 0 })
      return `cross ₹${c}/g · same shop ₹${s}/g`
    }
  }
  const pg = crossPg.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  return `₹${pg}/g`
}

/** Longer label for price breakdown rows on product cards. */
export function makingChargesBreakdownLabel(p: MarketplaceProductDTO, ctx?: CheckoutPricingContext): string {
  const mode = p.making_charge_mode?.trim() || MAKING_FIXED_PER_GRAM
  const sameJeweller = isSameStoreJeweller(p, ctx)
  if (mode === MAKING_PERCENT_OF_METAL) {
    const pct = effectiveMakingPercent(p, ctx)
    const s = pct.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    const tag = sameJeweller ? 'same-shop rate' : 'cross / other jeweller'
    return `Making (${s}% of gold metal · ${tag})`
  }
  const pg = effectiveMakingPerGram(p, ctx)
  const w = Number.parseFloat(p.gold_weight_grams)
  const pgS = pg.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  const wS = w.toLocaleString('en-IN', { maximumFractionDigits: 3 })
  const tag = sameJeweller ? 'same-shop ₹/g' : 'cross / other jeweller ₹/g'
  return `Making (₹${pgS}/g × ${wS}g · ${tag})`
}

function jewellerLineParts(p: MarketplaceProductDTO, ctx?: CheckoutPricingContext): JewellerParts {
  const goldValue = Number.parseFloat(p.gold_plus_stone_inr)
  const rawMakingCharges = rawMakingChargesInr(p, ctx)
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

/** Jeweller invoice subtotal only (no Cridora platform fee). Uses cross-jeweller making for catalogue sorting. */
export function jewellerSubtotalInr(p: MarketplaceProductDTO): number {
  return jewellerLineParts(p, undefined).jewellerSubtotal
}

/** Cridora cross-network fee; jewellers do not charge this. Waived when the customer holds vaulted gold at the listing jeweller. */
export function cridoraCrossPlatformFeeInr(p: MarketplaceProductDTO, ctx?: CheckoutPricingContext): number {
  if (!p.is_x_redeem) return 0
  const ids = ctx?.holdingsJewellerIds
  if (ids && ids.has(p.jeweller_id)) {
    return 0
  }
  const raw = p.cross_platform_fee_inr
  if (raw != null && raw !== '') {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return DEFAULT_CROSS_PLATFORM_FEE_INR
}

/** Grams at the listing vault metal rate (₹/g) needed to cover the full cash order total. */
export function vaultGramsAtListingRateForOrderInr(finalOrderInr: number, metalRateInrPerGram: number): number {
  if (!(metalRateInrPerGram > 0) || !(finalOrderInr > 0)) return 0
  return finalOrderInr / metalRateInrPerGram
}

/** True when vaulted grams at this custodian are enough to cover the full order at the listing vault rate. */
export function vaultCanCoverFullOrder(
  p: MarketplaceProductDTO,
  vaultBalanceGrams: number,
  ctx?: CheckoutPricingContext,
): boolean {
  const b = calculateCheckoutPrice(p, 0, 0, ctx)
  const need = vaultGramsAtListingRateForOrderInr(b.finalAmount, Number.parseFloat(p.metal_rate_inr_per_gram_used))
  return Math.max(0, vaultBalanceGrams) + 1e-9 >= need
}

/** @deprecated Use vaultCanCoverFullOrder — vault credit is not limited to piece gold weight. */
export function vaultCanCoverFullGoldWeight(p: MarketplaceProductDTO, vaultBalanceGrams: number): boolean {
  const w = Number.parseFloat(p.gold_weight_grams)
  const v = Math.max(0, vaultBalanceGrams)
  return w > 0 && v + 1e-9 >= w
}

export function calculateCheckoutPrice(
  p: MarketplaceProductDTO,
  vaultGramsToApply: number,
  vaultBalanceGrams: number,
  ctx?: CheckoutPricingContext,
): PriceBreakdown {
  const j = jewellerLineParts(p, ctx)
  const crossPlatformFee = cridoraCrossPlatformFeeInr(p, ctx)
  const finalAmount = j.jewellerSubtotal + crossPlatformFee
  const metalRate = Number.parseFloat(p.metal_rate_inr_per_gram_used)
  const cappedGrams = Math.max(0, Math.min(vaultGramsToApply, vaultBalanceGrams))
  const rawVaultInr = cappedGrams * metalRate
  const vaultValueOffset = Math.min(rawVaultInr, finalAmount)
  const payableAmount = Math.max(0, finalAmount - vaultValueOffset)
  const goldFromVault = metalRate > 0 ? vaultValueOffset / metalRate : 0

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
    goldFromVault,
    discountAmount: j.discountAmount,
  }
}

/** Customer-facing line when numeric same-store making is configured (listing copy). */
export function sameStoreMakingExplainer(p: MarketplaceProductDTO): string | null {
  const mode = p.making_charge_mode?.trim() || MAKING_FIXED_PER_GRAM
  if (mode === MAKING_PERCENT_OF_METAL) {
    const raw = p.same_store_making_charge_percent
    if (raw == null || String(raw).trim() === '') return null
    const cross = (p.making_charge_percent || '').toString().trim() || '—'
    return `If this jeweller is your default (same shop), making is ${raw}% of gold metal value; otherwise making is ${cross}% (cross purchase).`
  }
  const raw = p.same_store_making_charge_per_gram
  if (raw == null || String(raw).trim() === '') return null
  const cross = (p.making_charge_per_gram || '').toString().trim() || '—'
  return `If this jeweller is your default (same shop), making is ₹${raw}/g; otherwise ₹${cross}/g (cross purchase).`
}
