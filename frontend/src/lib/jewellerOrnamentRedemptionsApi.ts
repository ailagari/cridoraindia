import { authFetch } from '@/lib/api'

export type JewellerOrnamentRedemptionRowDTO = {
  id: number
  reference: string
  product_name: string
  customer: {
    email: string
    name: string
    cridora_member_id: string
  }
  grams_charged: string
  final_invoice_inr: string
  cash_paid_inr: string
  cash_payment_method: string
  gst_on_gold_saved_inr: string
  metal_rate_inr_per_gram: string
  same_store_checkout: boolean
  cross_platform_fee_inr: string
  created_at: string
}

export async function fetchJewellerOrnamentRedemptions(): Promise<
  { ok: true; results: JewellerOrnamentRedemptionRowDTO[] } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/jeweller/marketplace/ornament-redemptions/')
  const data = (await res.json().catch(() => ({}))) as {
    results?: JewellerOrnamentRedemptionRowDTO[]
    detail?: string
  }
  if (!res.ok) {
    return {
      ok: false,
      detail: data.detail != null ? String(data.detail) : 'Could not load ornament orders.',
    }
  }
  return { ok: true, results: Array.isArray(data.results) ? data.results : [] }
}
