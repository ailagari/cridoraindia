/** Cridora standard ornament tax — aligned with marketplace checkout. */

export const GST_ON_GOLD_PERCENT = 3
export const GST_ON_MAKING_PERCENT = 18
export const MARKETPLACE_MAKING_DISCOUNT_PERCENT = 5

export type OrnamentBillBreakdown = {
  metalInr: number
  makingInr: number
  gstOnGoldInr: number
  gstOnMakingInr: number
  totalInr: number
}

function parseN(s: string | number): number {
  const n = typeof s === 'number' ? s : Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** Multiplier on pre-GST metal ₹ to reach bill total (metal + MC + both GST lines). */
export function ornamentBillMultiplier(makingChargePercent: number): number {
  const mc = makingChargePercent / 100
  const gstGold = GST_ON_GOLD_PERCENT / 100
  const gstMc = GST_ON_MAKING_PERCENT / 100
  return 1 + gstGold + mc * (1 + gstMc)
}

export function gstOnGoldInr(metalInr: number): number {
  if (metalInr <= 0) return 0
  return (metalInr * GST_ON_GOLD_PERCENT) / 100
}

export function gstOnMakingInr(makingInr: number): number {
  if (makingInr <= 0) return 0
  return (makingInr * GST_ON_MAKING_PERCENT) / 100
}

export function ornamentBillFromMetal(
  metalInr: number,
  makingChargePercent = 0,
): OrnamentBillBreakdown {
  const metal = Math.max(0, metalInr)
  const making = (metal * makingChargePercent) / 100
  const gstOnGold = gstOnGoldInr(metal)
  const gstOnMaking = gstOnMakingInr(making)
  const total = metal + making + gstOnGold + gstOnMaking
  return { metalInr: metal, makingInr: making, gstOnGoldInr: gstOnGold, gstOnMakingInr: gstOnMaking, totalInr: total }
}

export function metalInrFromBillTotal(totalInr: number, makingChargePercent = 0): number {
  if (totalInr <= 0) return 0
  return totalInr / ornamentBillMultiplier(makingChargePercent)
}

export function ornamentBillFromWeightAndRate(
  weightGrams: number,
  ratePerGram: number,
  makingChargePercent = 0,
): OrnamentBillBreakdown | null {
  if (weightGrams <= 0 || ratePerGram <= 0) return null
  return ornamentBillFromMetal(weightGrams * ratePerGram, makingChargePercent)
}

export function ornamentBillFromTotal(
  weightGrams: number,
  totalInr: number,
  makingChargePercent = 0,
): (OrnamentBillBreakdown & { ratePerGram: number }) | null {
  if (weightGrams <= 0 || totalInr <= 0) return null
  const metal = metalInrFromBillTotal(totalInr, makingChargePercent)
  const bd = ornamentBillFromMetal(metal, makingChargePercent)
  return { ...bd, ratePerGram: metal / weightGrams }
}

/** Making charge in ₹ from metal value — percent or ₹/g modes. */
export function makingChargeInr(
  metalInr: number,
  weightGrams: number,
  mcValue: number,
  mode: 'percent' | 'per_gram',
): number {
  if (mcValue <= 0) return 0
  if (mode === 'percent') return (metalInr * mcValue) / 100
  return mcValue * weightGrams
}

export function ornamentBillFromCalculator(
  weightGrams: number,
  ratePerGram: number,
  mcValue: number,
  mcMode: 'percent' | 'per_gram',
): OrnamentBillBreakdown | null {
  if (weightGrams <= 0 || ratePerGram <= 0) return null
  const metal = weightGrams * ratePerGram
  const making = makingChargeInr(metal, weightGrams, mcValue, mcMode)
  const gstOnGold = gstOnGoldInr(metal)
  const gstOnMaking = gstOnMakingInr(making)
  return {
    metalInr: metal,
    makingInr: making,
    gstOnGoldInr: gstOnGold,
    gstOnMakingInr: gstOnMaking,
    totalInr: metal + making + gstOnGold + gstOnMaking,
  }
}

export function inrLabel(n: string | number): string {
  return parseN(n).toLocaleString('en-IN')
}
