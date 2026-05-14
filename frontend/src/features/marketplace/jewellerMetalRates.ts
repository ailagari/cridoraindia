import { parseN } from '@/features/marketplace/jewellerMarketplaceShared'

export type MetalPricingMode =
  | 'match_cridora'
  | 'markup_on_cridora'
  | 'manual_board_inr'
  | 'external_api'

export type MetalCode =
  | 'gold_22k'
  | 'gold_24k'
  | 'gold_21k'
  | 'gold_18k'
  | 'silver_999'
  | 'silver_925'

export const JEWELLER_METAL_ROWS: {
  code: MetalCode
  label: string
  sub: string
}[] = [
  { code: 'gold_22k', label: 'Gold 22K', sub: 'BIS 916 — ornament benchmark' },
  { code: 'gold_24k', label: 'Gold 24K', sub: 'Fine gold' },
  { code: 'gold_21k', label: 'Gold 21K', sub: '875 fineness' },
  { code: 'gold_18k', label: 'Gold 18K', sub: '750 fineness' },
  { code: 'silver_999', label: 'Silver 999', sub: 'Fine silver' },
  { code: 'silver_925', label: 'Silver 925', sub: 'Sterling' },
]

export type MetalPricingDraft = {
  mode: MetalPricingMode
  markup_percent: string
  markup_inr_per_gram: string
  manual_inr_per_gram: string
  external_api_url: string
}

export type MetalBuybackDraft = {
  deduction_percent: string
  fixed_inr_per_gram: string
  jeweller_deduction_inr_per_gram: string
}

export function defaultPricingDraft(): MetalPricingDraft {
  return {
    mode: 'match_cridora',
    markup_percent: '0',
    markup_inr_per_gram: '0',
    manual_inr_per_gram: '0',
    external_api_url: '',
  }
}

export function defaultBuybackDraft(): MetalBuybackDraft {
  return {
    deduction_percent: '0',
    fixed_inr_per_gram: '0',
    jeweller_deduction_inr_per_gram: '0',
  }
}

export function pricingDraftFromApi(raw: unknown): Record<MetalCode, MetalPricingDraft> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = {} as Record<MetalCode, MetalPricingDraft>
  for (const { code } of JEWELLER_METAL_ROWS) {
    const b = src[code]
    const d = defaultPricingDraft()
    if (b && typeof b === 'object') {
      const o = b as Record<string, unknown>
      const m = String(o.mode ?? '')
      if (
        m === 'match_cridora' ||
        m === 'markup_on_cridora' ||
        m === 'manual_board_inr' ||
        m === 'external_api'
      ) {
        d.mode = m
      }
      d.markup_percent = String(o.markup_percent ?? '0')
      d.markup_inr_per_gram = String(o.markup_inr_per_gram ?? '0')
      d.manual_inr_per_gram = String(o.manual_inr_per_gram ?? '0')
      d.external_api_url = String(o.external_api_url ?? '')
    }
    out[code] = d
  }
  return out
}

export function buybackDraftFromApi(raw: unknown): Record<MetalCode, MetalBuybackDraft> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = {} as Record<MetalCode, MetalBuybackDraft>
  for (const { code } of JEWELLER_METAL_ROWS) {
    const b = src[code]
    const d = defaultBuybackDraft()
    if (b && typeof b === 'object') {
      const o = b as Record<string, unknown>
      d.deduction_percent = String(o.deduction_percent ?? '0')
      d.fixed_inr_per_gram = String(o.fixed_inr_per_gram ?? '0')
      d.jeweller_deduction_inr_per_gram = String(o.jeweller_deduction_inr_per_gram ?? '0')
    }
    out[code] = d
  }
  return out
}

/** Resolved Cridora ₹/g reference for dashboard preview (spot payload + resolved 22K base). */
export function cridoraRefInrForMetal(
  code: MetalCode,
  platformBase22k: number,
  spot: { gold?: Record<string, number>; silver?: Record<string, number> } | null,
): number {
  if (code === 'gold_22k') {
    return platformBase22k > 0 ? platformBase22k : 0
  }
  const g = spot?.gold
  const sv = spot?.silver
  if (code === 'gold_24k') {
    const v = g?.['24K']
    if (v != null && Number.isFinite(v)) return v
    if (platformBase22k > 0) return platformBase22k / 0.916
    return 0
  }
  if (code === 'gold_21k') {
    const v = g?.['21K']
    if (v != null && Number.isFinite(v)) return v
    if (platformBase22k > 0) return (platformBase22k / 0.916) * 0.875
    return 0
  }
  if (code === 'gold_18k') {
    const v = g?.['18K']
    if (v != null && Number.isFinite(v)) return v
    if (platformBase22k > 0) return (platformBase22k / 0.916) * 0.75
    return 0
  }
  if (code === 'silver_999') {
    const v = sv?.['999']
    return v != null && Number.isFinite(v) ? v : 0
  }
  if (code === 'silver_925') {
    const v = sv?.['925']
    return v != null && Number.isFinite(v) ? v : 0
  }
  return 0
}

export function computeJewellerBoardInrPerGram(cridoraRef: number, block: MetalPricingDraft): number {
  if (!(cridoraRef >= 0) || !Number.isFinite(cridoraRef)) return 0
  switch (block.mode) {
    case 'match_cridora':
    case 'external_api':
      return cridoraRef
    case 'manual_board_inr': {
      const m = parseN(block.manual_inr_per_gram)
      return m > 0 ? m : cridoraRef
    }
    case 'markup_on_cridora': {
      const p = parseN(block.markup_percent)
      const f = parseN(block.markup_inr_per_gram)
      return Math.max(0, cridoraRef * (1 + p / 100) + f)
    }
    default:
      return cridoraRef
  }
}

export function previewBuybackInrPerGram(boardInrPerGram: number, bb: MetalBuybackDraft): number {
  const pct = parseN(bb.deduction_percent)
  const fix = parseN(bb.fixed_inr_per_gram)
  const ex = parseN(bb.jeweller_deduction_inr_per_gram)
  const a = boardInrPerGram * (1 - pct / 100)
  return Math.max(0, a - fix - ex)
}

/** Total ₹/g taken off your board rate for buyback (percent slice + fixed + extra). */
export function totalBuybackDeductionPerGram(boardInrPerGram: number, bb: MetalBuybackDraft): number {
  if (!(boardInrPerGram >= 0) || !Number.isFinite(boardInrPerGram)) return 0
  const buy = previewBuybackInrPerGram(boardInrPerGram, bb)
  return Math.max(0, boardInrPerGram - buy)
}
