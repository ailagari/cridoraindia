import type { JewellerStorefrontDTO } from '@/lib/marketplaceApi'

/** Active marketplace features for a jeweller (directory cards + storefront page). */
export function jewellerStorefrontFeatureChips(j: JewellerStorefrontDTO): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  if (j.feat_goldnest_available) out.push({ key: 'fractional', label: 'Fractional gold' })
  if (j.feat_loan_available) out.push({ key: 'loan', label: 'Gold loans' })
  if (j.feat_instant_redemption) out.push({ key: 'instant', label: 'Instant redemption' })
  if (j.feat_zero_mc_same_store) out.push({ key: '0mc', label: '0% MC (same store)' })
  if (j.feat_emergency_funds) out.push({ key: 'em', label: 'Emergency funds' })
  if (j.feat_cross_redemption) out.push({ key: 'cross', label: 'Cross-jeweller redemption' })
  return out
}

export type SellbackMode = 'percent' | 'fixed'

export function formatInr(n: number, fractionDigits = 2): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

export function parseN(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function numOrZero(s: string): string {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? String(n) : '0'
}

export function inferSellbackMode(pctStr: string, fixStr: string): SellbackMode {
  const pct = parseN(pctStr)
  const fix = parseN(fixStr)
  if (pct > 0) return 'percent'
  if (fix > 0) return 'fixed'
  return 'percent'
}

export function previewIndicativeBuyback(
  jewellerStore22k: number,
  defaultMarkupPct: number,
  mode: SellbackMode,
  pctStr: string,
  fixStr: string,
): number {
  const refMetal = jewellerStore22k * (1 + defaultMarkupPct / 100)
  if (mode === 'percent') {
    const p = parseN(pctStr)
    return Math.max(0, refMetal * (1 - p / 100))
  }
  const f = parseN(fixStr)
  return Math.max(0, refMetal - f)
}
