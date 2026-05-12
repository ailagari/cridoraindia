import { apiFetch } from '@/lib/api'

export type GoldTickerPayload = {
  reference_price_inr_per_gram_22k: string
  admin_markup_percent: string
  platform_base_inr_per_gram_22k: string
  cridora_base_source?: string
  updated_at: string
}

export type SpotPricesPayload = {
  currency: string
  unit: string
  source: string
  note?: string
  usd_to_inr?: number
  usd_to_inr_source?: string
  gold: Record<string, number>
  silver?: Record<string, number>
  ticker_items?: Array<{ label: string; value?: number; text?: string }>
}

export type MarketplaceProductDTO = {
  id: number
  jeweller_id: number
  name: string
  category: string
  gold_weight_grams: string
  making_charge_mode: string
  making_charge_per_gram: string
  making_charge_percent: string
  image_url: string
  is_x_redeem: boolean
  rating: string
  jeweller_name: string
  jeweller_city: string
  pricing_mode: string
  platform_base_inr_per_gram_22k: string
  cridora_base_source?: string
  metal_rate_inr_per_gram_used: string
  jeweller_markup_percent_applied: string
  gold_metal_value_inr: string
  stone_component_inr: string
  gold_plus_stone_inr: string
  sellback_indicative_inr_per_gram: string
  sellback_deduction_percent: string
  sellback_fixed_inr_per_gram: string
  gold_deposit_note: string
  stone_included: boolean
  stone_type: string
  stone_weight_grams: string
  stone_cost_inr: string
  same_store_benefit_note: string
}

export type JewellerStorefrontDTO = {
  id: number
  business_name: string
  city: string
  state: string
  shop_address: string
  gstin: string
  kyc_status: string
  platform_base_inr_per_gram_22k: string
  cridora_base_source?: string
  jeweller_store_22k_inr_per_gram?: string
  gold_rate_source?: string
  representative_making_charge_inr_per_gram: string
  buyback_indicative_inr_per_gram: string
  buyback_uses_headline_override: boolean
  reference_metal_inr_per_gram: string
  gold_deposit_yield_apr_percent: string
  gold_loan_interest_apr_percent: string
  gold_deposit_note: string
  default_gold_markup_percent: string
  sellback_deduction_percent: string
  sellback_fixed_inr_per_gram: string
  approved_listing_count: number
  logo_url: string
  credibility_score: string
  lock_in_summary: string
  minimum_redeemable_grams: string
  same_store_mc_benefit: string
  cross_redemption_fee_note: string
  metric_active_users: number
  metric_total_redeemed_gold_grams: string
  metric_years_active: string
  feat_instant_redemption: boolean
  feat_zero_mc_same_store: boolean
  feat_loan_available: boolean
  feat_goldnest_available: boolean
  feat_emergency_funds: boolean
  feat_cross_redemption: boolean
}

export async function fetchGoldTicker(): Promise<GoldTickerPayload | null> {
  const res = await apiFetch('/api/v1/marketplace/gold-ticker/')
  if (!res.ok) {
    return null
  }
  return (await res.json()) as GoldTickerPayload
}

export async function fetchSpotPrices(): Promise<SpotPricesPayload | null> {
  const res = await apiFetch('/api/v1/marketplace/spot-prices/', { cache: 'no-store' })
  if (!res.ok) {
    return null
  }
  return (await res.json()) as SpotPricesPayload
}

export async function fetchMarketplaceProducts(opts?: {
  category?: string
  jewellerId?: number
}): Promise<MarketplaceProductDTO[]> {
  const params = new URLSearchParams()
  const cat = opts?.category?.trim()
  if (cat && cat !== 'All') {
    params.set('category', cat)
  }
  if (opts?.jewellerId != null && Number.isFinite(opts.jewellerId)) {
    params.set('jeweller', String(opts.jewellerId))
  }
  const q = params.toString()
  const res = await apiFetch(`/api/v1/marketplace/products/${q ? `?${q}` : ''}`)
  if (!res.ok) {
    return []
  }
  const body = (await res.json()) as { results?: MarketplaceProductDTO[] }
  return body.results ?? []
}

export async function fetchVerifiedJewellers(city?: string): Promise<JewellerStorefrontDTO[]> {
  const q = city && city !== 'All Cities' ? `?city=${encodeURIComponent(city)}` : ''
  const res = await apiFetch(`/api/v1/marketplace/jewellers/${q}`)
  if (!res.ok) {
    return []
  }
  const body = (await res.json()) as { results?: JewellerStorefrontDTO[] }
  return body.results ?? []
}

export async function fetchJewellerStorefront(id: number): Promise<JewellerStorefrontDTO | null> {
  const res = await apiFetch(`/api/v1/marketplace/jewellers/${id}/`)
  if (!res.ok) {
    return null
  }
  return (await res.json()) as JewellerStorefrontDTO
}
