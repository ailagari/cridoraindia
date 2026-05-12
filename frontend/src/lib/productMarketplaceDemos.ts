import type { MarketplaceProductDTO } from '@/lib/marketplaceApi'

const DEMO_PLATFORM_BASE = '7320.00'

/** Matches storefront dummy jewellers in `jewellerMarketplaceDemos.ts`. */
const J = {
  hyderabad: {
    jeweller_id: -1,
    jeweller_name: 'Demo Gold House — Hyderabad',
    jeweller_city: 'Hyderabad',
    markup: '1.250',
    metal: '7411.50',
    sellback: '7055.62',
    sellbackPct: '2.000',
    sellbackFixed: '15.00',
    mcPerG: '720',
    gold_note:
      'Vault gold credited to this showroom settles per Cridora ledger (T+1). Indicative sellback uses the rates shown on each listing.',
    same_note: '0% MC same store on ornament redeem',
  },
  kochi: {
    jeweller_id: -2,
    jeweller_name: 'Heritage Bay Jewellers — Kochi',
    jeweller_city: 'Kochi',
    markup: '0.800',
    metal: '7378.56',
    sellback: '7176.73',
    sellbackPct: '1.500',
    sellbackFixed: '12.00',
    mcPerG: '680',
    gold_note: 'Dummy Kochi: gold deposit scheme yield shown for UI demo only.',
    same_note: '50% MC reduction same store',
  },
  mumbai: {
    jeweller_id: -3,
    jeweller_name: 'Metro Gold Palace — Mumbai',
    jeweller_city: 'Mumbai',
    markup: '1.100',
    metal: '7400.52',
    sellback: '7022.94',
    sellbackPct: '2.250',
    sellbackFixed: '18.00',
    mcPerG: '920',
    gold_note: 'Dummy Mumbai: locker-linked deposits and loan APRs are illustrative.',
    same_note: 'Flat ₹499 MC select bridal',
  },
  bengaluru: {
    jeweller_id: -4,
    jeweller_name: 'Garden City Ornaments — Bengaluru',
    jeweller_city: 'Bengaluru',
    markup: '1.600',
    metal: '7437.12',
    sellback: '7040.81',
    sellbackPct: '1.800',
    sellbackFixed: '14.50',
    mcPerG: '790',
    gold_note: 'Dummy Bengaluru: compare with other dummy showrooms on the jeweller marketplace.',
    same_note: '0% MC · loyalty tier',
  },
} as const

function demoRow(
  id: number,
  shop: (typeof J)[keyof typeof J],
  piece: {
    name: string
    category: string
    goldWeightG: string
    image_url: string
    making_charge_mode?: string
    making_charge_per_gram?: string
    making_charge_percent?: string
    stone_included?: boolean
    stone_type?: string
    stone_weight_grams?: string
    stone_cost_inr?: string
    stone_component_inr?: string
    gold_metal_value_inr: string
    gold_plus_stone_inr: string
    rating?: string
    is_x_redeem?: boolean
    same_store_benefit_note?: string
    sellback_indicative_inr_per_gram?: string
  },
): MarketplaceProductDTO {
  const stoneInc = Boolean(piece.stone_included)
  const stoneComp = piece.stone_component_inr ?? '0'
  return {
    id,
    jeweller_id: shop.jeweller_id,
    name: piece.name,
    category: piece.category,
    gold_weight_grams: piece.goldWeightG,
    making_charge_mode: piece.making_charge_mode ?? 'fixed_per_gram',
    making_charge_per_gram: piece.making_charge_per_gram ?? shop.mcPerG + '.00',
    making_charge_percent: piece.making_charge_percent ?? '',
    image_url: piece.image_url,
    is_x_redeem: piece.is_x_redeem ?? true,
    rating: piece.rating ?? '4.7',
    jeweller_name: shop.jeweller_name,
    jeweller_city: shop.jeweller_city,
    pricing_mode: 'spot_markup',
    platform_base_inr_per_gram_22k: DEMO_PLATFORM_BASE,
    metal_rate_inr_per_gram_used: shop.metal,
    jeweller_markup_percent_applied: shop.markup,
    gold_metal_value_inr: piece.gold_metal_value_inr,
    stone_component_inr: stoneComp,
    gold_plus_stone_inr: piece.gold_plus_stone_inr,
    sellback_indicative_inr_per_gram: piece.sellback_indicative_inr_per_gram ?? shop.sellback,
    sellback_deduction_percent: shop.sellbackPct,
    sellback_fixed_inr_per_gram: shop.sellbackFixed,
    gold_deposit_note: shop.gold_note,
    stone_included: stoneInc,
    stone_type: piece.stone_type ?? '',
    stone_weight_grams: piece.stone_weight_grams ?? '',
    stone_cost_inr: piece.stone_cost_inr ?? '',
    same_store_benefit_note: piece.same_store_benefit_note ?? shop.same_note,
  }
}

export const PRODUCT_MARKETPLACE_DEMO_ROWS: MarketplaceProductDTO[] = [
  demoRow(-1001, J.hyderabad, {
    name: 'Temple weave bridal necklace · BIS 916',
    category: 'Necklace',
    goldWeightG: '42.800',
    image_url: 'https://images.unsplash.com/photo-1617038260897-41a1fee14bd4?w=800&q=80',
    gold_metal_value_inr: '317212.20',
    gold_plus_stone_inr: '317212.20',
    rating: '4.9',
    same_store_benefit_note: 'Same-store redemption: headline MC waiver per storefront rules.',
  }),
  demoRow(-1002, J.hyderabad, {
    name: 'Classic Cuban chain · 22K',
    category: 'Chain',
    goldWeightG: '18.650',
    image_url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80',
    gold_metal_value_inr: '138223.98',
    gold_plus_stone_inr: '138225.98',
  }),
  demoRow(-1003, J.hyderabad, {
    name: 'Heritage mango mala · ruby accents',
    category: 'Necklace',
    goldWeightG: '55.200',
    gold_metal_value_inr: '409114.80',
    stone_included: true,
    stone_type: 'Ruby (syn.)',
    stone_weight_grams: '1.850',
    stone_cost_inr: '18500.00',
    stone_component_inr: '18500.00',
    gold_plus_stone_inr: '427614.80',
    image_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80',
    making_charge_percent: '10.500',
    making_charge_mode: 'percent_of_metal',
    making_charge_per_gram: '0',
    rating: '4.8',
  }),
  demoRow(-1004, J.kochi, {
    name: 'Daily wear rope chain · light',
    category: 'Chain',
    goldWeightG: '8.400',
    image_url: 'https://images.unsplash.com/photo-1611591437289-04442554fa99?w=800&q=80',
    gold_metal_value_inr: '61979.90',
    gold_plus_stone_inr: '61979.90',
    rating: '4.6',
  }),
  demoRow(-1005, J.kochi, {
    name: 'Stackable infinity band · matte',
    category: 'Ring',
    goldWeightG: '4.250',
    image_url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=80',
    gold_metal_value_inr: '31358.88',
    gold_plus_stone_inr: '31358.88',
    is_x_redeem: false,
  }),
  demoRow(-1006, J.kochi, {
    name: 'Temple coin pendant · Lakshmi motif',
    category: 'Pendant',
    goldWeightG: '12.100',
    image_url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80',
    gold_metal_value_inr: '89480.58',
    gold_plus_stone_inr: '89280.58',
  }),
  demoRow(-1007, J.mumbai, {
    name: 'Bold cuff kada · brushed finish',
    category: 'Bangle',
    goldWeightG: '38.950',
    image_url: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=800&q=80',
    gold_metal_value_inr: '288350.45',
    gold_plus_stone_inr: '288250.26',
    rating: '4.7',
  }),
  demoRow(-1008, J.mumbai, {
    name: 'Solitaire illusion ring · demo diamond line',
    category: 'Ring',
    goldWeightG: '6.850',
    gold_metal_value_inr: '50693.56',
    stone_included: true,
    stone_type: 'Natural diamond line',
    stone_weight_grams: '0.080',
    stone_cost_inr: '125000.00',
    stone_component_inr: '125000.00',
    gold_plus_stone_inr: '175693.56',
    image_url: 'https://images.unsplash.com/photo-1603561596112-e594f58982df?w=800&q=80',
    making_charge_percent: '12.000',
    making_charge_mode: 'percent_of_metal',
    making_charge_per_gram: '0',
    rating: '4.95',
  }),
  demoRow(-1009, J.mumbai, {
    name: 'Five‑figure sovereign strip · sealed blister',
    category: 'Coin',
    goldWeightG: '40.000',
    image_url: 'https://images.unsplash.com/photo-1610375460909-d82cfa76edc9?w=800&q=80',
    gold_metal_value_inr: '296020.80',
    gold_plus_stone_inr: '296020.80',
    same_store_benefit_note: 'Bulk coins — locker pickup slots shown at checkout.',
  }),
  demoRow(-1010, J.bengaluru, {
    name: 'Minimal paperclip bracelet · adjustable',
    category: 'Bracelet',
    goldWeightG: '14.550',
    image_url: 'https://images.unsplash.com/photo-1611591437289-04442554fa99?w=800&q=80',
    gold_metal_value_inr: '108210.10',
    gold_plus_stone_inr: '108260.10',
  }),
  demoRow(-1011, J.bengaluru, {
    name: 'Micro‑stud hoop pair · hinge closure',
    category: 'Earrings',
    goldWeightG: '7.100',
    image_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80',
    gold_metal_value_inr: '52803.55',
    gold_plus_stone_inr: '52803.55',
    rating: '4.65',
  }),
  demoRow(-1012, J.bengaluru, {
    name: 'Statement choker · antique matte gold',
    category: 'Necklace',
    goldWeightG: '62.400',
    image_url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80',
    gold_metal_value_inr: '464076.29',
    gold_plus_stone_inr: '464076.29',
    rating: '4.85',
  }),
]

function normKey(jewellerName: string, productName: string): string {
  return `${jewellerName.trim().toLowerCase()}|${productName.trim().toLowerCase()}`
}

/** Append offline catalogue rows when the API list is empty or missing those SKUs (live rows win on same jeweller + name). */
export function mergeProductCatalogWithDemos(apiRows: MarketplaceProductDTO[]): MarketplaceProductDTO[] {
  const keys = new Set(apiRows.map((r) => normKey(r.jeweller_name, r.name)))
  const extras = PRODUCT_MARKETPLACE_DEMO_ROWS.filter((d) => !keys.has(normKey(d.jeweller_name, d.name)))
  return [...apiRows, ...extras]
}
