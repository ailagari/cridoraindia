import { apiFetch, authFetch } from '@/lib/api'

export type GoldTickerPayload = {
  platform_base_inr_per_gram_22k: string
  cridora_base_source?: string
  cross_platform_fee_inr?: string
  updated_at: string
}

export type LiveRawSpotPayload = {
  currency: string
  unit: string
  source: string
  note?: string
  gold: Record<string, number>
  silver?: Record<string, number>
  usd_to_inr?: number
  usd_to_inr_source?: string
}

export type KeralaBoardPayload = {
  gold: Record<string, number>
  silver?: Record<string, number>
  source?: string
  source_updated_at?: string
  rate_date?: string
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
  /** Raw Kerala gold rate ₹/g (unadjusted board reference). */
  kerala_board?: KeralaBoardPayload
  ticker_items?: Array<{ label: string; value?: number; text?: string }>
  /** Unadjusted international INR/g ladder — present only on admin spot-prices endpoint. */
  live_raw_spot?: LiveRawSpotPayload | null
  /** Canonical 22K ₹/g (published live market base). */
  platform_base_inr_per_gram_22k?: string
  cridora_base_source?: string
}

export type MarketplaceProductDTO = {
  id: number
  jeweller_id: number
  name: string
  category: string
  product_category_id?: number
  metal_purity_id?: number
  metal_purity_slug?: string
  metal_purity_label?: string
  stock_quantity?: number
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
  /** ISO timestamp — when this jeweller&apos;s quoted metal rate was last considered current. */
  jeweller_metal_rate_last_updated_at?: string
  /** Present only on jeweller/admin product payloads (internal comparison). */
  platform_base_inr_per_gram_22k?: string
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
  /** Cridora cross-jeweller checkout fee (₹) when `is_x_redeem`; from platform ticker config. */
  cross_platform_fee_inr: string
  same_store_making_charge_percent?: string
  same_store_making_charge_per_gram?: string
}

export type JewellerStorefrontDTO = {
  id: number
  business_name: string
  city: string
  state: string
  shop_address: string
  gstin: string
  kyc_status: string
  jeweller_metal_rate_last_updated_at?: string
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
  golden_scheme_enabled?: boolean
  golden_scheme_summary?: string
  golden_scheme_duration_months?: string
  golden_scheme_min_monthly_inr?: string
  golden_scheme_lock_in_note?: string
  golden_scheme_benefits?: string
  golden_scheme_rate_application_note?: string
  gold_loan_processing_fee_percent?: string
  gold_loan_ltv_min_percent?: string
  gold_loan_ltv_max_percent?: string
  gold_loan_ltv_percent?: string
  gold_loan_jeweller_deduction_inr_per_gram?: string
}

export type CatalogMetalPurityDTO = {
  id: number
  slug: string
  label: string
  fine_fraction?: string
  spot_family?: string
  spot_key?: string
}
export type CatalogProductCategoryDTO = { id: number; slug: string; label: string }

export type MarketplaceCatalogMetaDTO = {
  metal_purities: CatalogMetalPurityDTO[]
  product_categories: CatalogProductCategoryDTO[]
}

export async function fetchMarketplaceCatalogMeta(): Promise<MarketplaceCatalogMetaDTO | null> {
  const res = await apiFetch('/api/v1/marketplace/catalog-meta/')
  if (!res.ok) {
    return null
  }
  return (await res.json()) as MarketplaceCatalogMetaDTO
}

export async function fetchMarketplaceProduct(id: number): Promise<MarketplaceProductDTO | null> {
  const res = await apiFetch(`/api/v1/marketplace/products/${id}/`)
  if (!res.ok) {
    return null
  }
  return (await res.json()) as MarketplaceProductDTO
}

export type GoldTickerHistoryPoint = {
  t: string
  v: string
  src?: string
  open?: string
  high?: string
  low?: string
  change_inr?: string
  change_pct?: string
}

export type GoldTickerHistoryPayload = {
  range: string
  granularity?: 'intraday' | 'daily'
  window_hours?: number
  retention_days?: number
  note?: string
  points: GoldTickerHistoryPoint[]
  latest?: { t: string; v: string; source?: string }
}

export async function fetchGoldTicker(): Promise<GoldTickerPayload | null> {
  const res = await apiFetch('/api/v1/marketplace/gold-ticker/')
  if (!res.ok) {
    return null
  }
  return (await res.json()) as GoldTickerPayload
}

export async function fetchGoldTickerHistory(range = '1d'): Promise<GoldTickerHistoryPayload | null> {
  const res = await apiFetch(
    `/api/v1/marketplace/gold-ticker/history/?range=${encodeURIComponent(range)}`,
    { cache: 'no-store' },
  )
  if (!res.ok) {
    return null
  }
  return (await res.json()) as GoldTickerHistoryPayload
}

export async function fetchSpotPrices(): Promise<SpotPricesPayload | null> {
  const res = await apiFetch('/api/v1/marketplace/spot-prices/', { cache: 'no-store' })
  if (!res.ok) {
    return null
  }
  return (await res.json()) as SpotPricesPayload
}

export type KeralaGoldRatesPayload = {
  region: string
  currency: string
  unit: string
  source?: string
  source_updated_at?: string
  rate_date?: string
  gold: Record<string, number>
  silver?: Record<string, number>
  daily_change?: Record<string, { change_inr?: string | null; change_pct?: string | null }>
  latest_point?: Record<string, unknown>
  note?: string
}

export type KeralaGoldRatesHistoryPayload = GoldTickerHistoryPayload & {
  metal?: string
  latest?: Record<string, unknown>
}

export type KeralaGoldRatesDailyRow = {
  date: string
  gold_24k: string
  gold_22k: string
  gold_18k: string
  silver_999?: string | null
  source?: string
}

export type KeralaGoldRatesDailyPayload = {
  total: number
  limit: number
  offset: number
  retention_days?: number
  rows: KeralaGoldRatesDailyRow[]
}

export type GoldRatesAdPlacementDTO = {
  id: number
  slot: string
  label: string
  mode: 'manual' | 'image' | 'adsense'
  manual_html?: string
  image_url?: string
  image_link_url?: string
  image_alt?: string
  adsense_slot_id?: string
  adsense_format?: string
  is_active: boolean
  sort_order: number
}

export type GoldRatesAdsPayload = {
  adsense_enabled: boolean
  adsense_client_id: string
  page_title?: string
  page_description?: string
  placements: GoldRatesAdPlacementDTO[]
}

export async function fetchKeralaGoldRates(): Promise<KeralaGoldRatesPayload | null> {
  const res = await apiFetch('/api/v1/marketplace/kerala-gold-rates/', { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as KeralaGoldRatesPayload
}

export async function fetchKeralaGoldRatesHistory(
  range = '1m',
  metal = '22K',
): Promise<KeralaGoldRatesHistoryPayload | null> {
  const params = new URLSearchParams({ range, metal })
  const res = await apiFetch(`/api/v1/marketplace/kerala-gold-rates/history/?${params}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as KeralaGoldRatesHistoryPayload
}

export async function fetchKeralaGoldRatesDaily(
  limit = 60,
  offset = 0,
): Promise<KeralaGoldRatesDailyPayload | null> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const res = await apiFetch(`/api/v1/marketplace/kerala-gold-rates/daily/?${params}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as KeralaGoldRatesDailyPayload
}

export async function fetchGoldRatesAds(): Promise<GoldRatesAdsPayload | null> {
  const res = await apiFetch('/api/v1/marketplace/gold-rates/ads/', { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as GoldRatesAdsPayload
}

export type AdminGoldRatesPageConfigPayload = GoldRatesAdsPayload & {
  updated_at?: string | null
}

export async function fetchAdminGoldRatesConfig(): Promise<AdminGoldRatesPageConfigPayload | null> {
  const res = await authFetch('/api/v1/admin/gold-rates/config/', { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as AdminGoldRatesPageConfigPayload
}

export async function patchAdminGoldRatesConfig(
  body: Partial<AdminGoldRatesPageConfigPayload>,
): Promise<AdminGoldRatesPageConfigPayload | null> {
  const res = await authFetch('/api/v1/admin/gold-rates/config/', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  return (await res.json()) as AdminGoldRatesPageConfigPayload
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
