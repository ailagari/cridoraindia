import { MAKING_FIXED_PER_GRAM, MAKING_PERCENT_OF_METAL } from '@/lib/marketplacePricing'
import { numOrZero } from '@/features/marketplace/jewellerMarketplaceShared'

export type ProductRow = Record<string, unknown>

export type SkuFormState = {
  name: string
  product_category_id: string
  metal_purity_id: string
  stock_quantity: string
  gold_weight_grams: string
  making_charge_mode: string
  making_charge_per_gram: string
  making_charge_percent: string
  image_url: string
  pricing_mode: string
  jeweller_markup_percent: string
  manual_gold_rate_inr_per_gram: string
  stone_included: boolean
  stone_type: string
  stone_weight_grams: string
  stone_cost_inr: string
  is_x_redeem: boolean
  is_published: boolean
  rating: string
  same_store_making_charge_percent: string
  same_store_making_charge_per_gram: string
}

export const INITIAL_SKU_FORM: SkuFormState = {
  name: '',
  product_category_id: '',
  metal_purity_id: '',
  stock_quantity: '1',
  gold_weight_grams: '',
  making_charge_mode: MAKING_FIXED_PER_GRAM,
  making_charge_per_gram: '',
  making_charge_percent: '',
  image_url: '',
  pricing_mode: 'spot_markup',
  jeweller_markup_percent: '',
  manual_gold_rate_inr_per_gram: '',
  stone_included: false,
  stone_type: '',
  stone_weight_grams: '',
  stone_cost_inr: '',
  is_x_redeem: true,
  is_published: true,
  rating: '4.5',
  same_store_making_charge_percent: '',
  same_store_making_charge_per_gram: '',
}

export type SkuPayloadBuilt = { ok: true; body: Record<string, unknown> } | { ok: false; error: string }

export function buildSkuPayload(f: SkuFormState): SkuPayloadBuilt {
  const pcId = Number.parseInt(f.product_category_id, 10)
  const mpId = Number.parseInt(f.metal_purity_id, 10)
  const stockN = Number.parseInt(f.stock_quantity, 10)
  if (!Number.isFinite(pcId) || pcId < 1) {
    return { ok: false, error: 'Choose a category from the dropdown.' }
  }
  if (!Number.isFinite(mpId) || mpId < 1) {
    return { ok: false, error: 'Choose a metal purity.' }
  }
  if (!Number.isFinite(stockN) || stockN < 0) {
    return { ok: false, error: 'Stock quantity must be a whole number (0 or more).' }
  }
  const body: Record<string, unknown> = {
    name: f.name.trim(),
    product_category: pcId,
    metal_purity: mpId,
    stock_quantity: stockN,
    gold_weight_grams: numOrZero(f.gold_weight_grams),
    making_charge_mode: f.making_charge_mode,
    image_url: f.image_url.trim(),
    pricing_mode: f.pricing_mode,
    is_x_redeem: f.is_x_redeem,
    is_published: f.is_published,
    rating: numOrZero(f.rating),
    stone_included: f.stone_included,
    stone_type: f.stone_type.trim(),
  }
  if (f.making_charge_mode === MAKING_PERCENT_OF_METAL) {
    body.making_charge_percent = numOrZero(f.making_charge_percent)
    body.making_charge_per_gram = '0'
    const ss = f.same_store_making_charge_percent.trim()
    body.same_store_making_charge_percent = ss !== '' ? numOrZero(ss) : null
    body.same_store_making_charge_per_gram = null
  } else {
    body.making_charge_per_gram = numOrZero(f.making_charge_per_gram)
    body.making_charge_percent = null
    const ss = f.same_store_making_charge_per_gram.trim()
    body.same_store_making_charge_per_gram = ss !== '' ? numOrZero(ss) : null
    body.same_store_making_charge_percent = null
  }
  const jmp = f.jeweller_markup_percent.trim()
  if (jmp !== '') {
    body.jeweller_markup_percent = numOrZero(jmp)
  } else {
    body.jeweller_markup_percent = null
  }
  if (f.pricing_mode === 'manual_rate') {
    body.manual_gold_rate_inr_per_gram = numOrZero(f.manual_gold_rate_inr_per_gram)
  } else {
    body.manual_gold_rate_inr_per_gram = null
  }
  if (f.stone_included) {
    const sw = f.stone_weight_grams.trim()
    if (sw !== '') {
      body.stone_weight_grams = numOrZero(sw)
    } else {
      body.stone_weight_grams = null
    }
    const sc = f.stone_cost_inr.trim()
    if (sc !== '') {
      body.stone_cost_inr = numOrZero(sc)
    } else {
      body.stone_cost_inr = null
    }
  } else {
    body.stone_weight_grams = null
    body.stone_cost_inr = null
  }
  return { ok: true, body }
}

export function rowToEditForm(row: ProductRow): SkuFormState {
  const mode =
    String(row.making_charge_mode ?? MAKING_FIXED_PER_GRAM) === MAKING_PERCENT_OF_METAL
      ? MAKING_PERCENT_OF_METAL
      : MAKING_FIXED_PER_GRAM
  const pcId = row.product_category_id
  const mpId = row.metal_purity_id
  return {
    name: String(row.name ?? ''),
    product_category_id: pcId != null ? String(pcId) : '',
    metal_purity_id: mpId != null ? String(mpId) : '',
    stock_quantity: String(row.stock_quantity ?? '0'),
    gold_weight_grams: String(row.gold_weight_grams ?? ''),
    making_charge_mode: mode,
    making_charge_per_gram: String(row.making_charge_per_gram ?? ''),
    making_charge_percent: String(row.making_charge_percent ?? ''),
    image_url: String(row.image_url ?? ''),
    pricing_mode: String(row.pricing_mode ?? 'spot_markup'),
    jeweller_markup_percent: String(row.jeweller_markup_percent ?? ''),
    manual_gold_rate_inr_per_gram: String(row.manual_gold_rate_inr_per_gram ?? ''),
    stone_included: Boolean(row.stone_included),
    stone_type: String(row.stone_type ?? ''),
    stone_weight_grams: String(row.stone_weight_grams ?? ''),
    stone_cost_inr: String(row.stone_cost_inr ?? ''),
    is_x_redeem: Boolean(row.is_x_redeem),
    is_published: Boolean(row.is_published),
    rating: String(row.rating ?? '4.5'),
    same_store_making_charge_percent: String(row.same_store_making_charge_percent ?? ''),
    same_store_making_charge_per_gram: String(row.same_store_making_charge_per_gram ?? ''),
  }
}
