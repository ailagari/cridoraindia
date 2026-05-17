import { authFetch } from '@/lib/api'

export type VaultRedemptionQuoteDTO = {
  product_id: number
  product_name: string
  jeweller_id: number
  jeweller_name: string
  stock_quantity: number
  final_invoice_inr: string
  jeweller_subtotal_inr: string
  metal_rate_inr_per_gram: string
  grams_required: string
  vault_grams_available: string
  sufficient_vault: boolean
  same_store: boolean
  cross_platform_fee_inr: string
}

export async function fetchVaultRedemptionQuote(
  productId: number,
): Promise<{ ok: true; data: VaultRedemptionQuoteDTO } | { ok: false; detail: string }> {
  const res = await authFetch(
    `/api/v1/marketplace/redemption/quote/?product_id=${encodeURIComponent(String(productId))}`,
  )
  const data = (await res.json().catch(() => ({}))) as VaultRedemptionQuoteDTO & { detail?: string }
  if (!res.ok) {
    return {
      ok: false,
      detail: data.detail != null ? String(data.detail) : 'Could not load quote.',
    }
  }
  if (typeof data.product_id !== 'number') {
    return { ok: false, detail: 'Invalid quote response.' }
  }
  return { ok: true, data: data as VaultRedemptionQuoteDTO }
}

export async function confirmVaultRedemptionPurchase(
  productId: number,
  expected?: { final_invoice_inr: string; grams_required: string },
): Promise<
  | {
      ok: true
      detail: string
      redemption: {
        id: number
        reference: string
        grams_charged: string
        final_invoice_inr: string
        product_name: string
        jeweller_name: string
      }
    }
  | { ok: false; detail: string; staleQuote?: VaultRedemptionQuoteDTO }
> {
  const jsonBody: Record<string, unknown> = { product_id: productId }
  if (expected) {
    jsonBody.expected_final_invoice_inr = expected.final_invoice_inr
    jsonBody.expected_grams_required = expected.grams_required
  }
  const res = await authFetch('/api/v1/marketplace/redemption/confirm/', {
    method: 'POST',
    jsonBody,
  })
  const data = (await res.json().catch(() => ({}))) as {
    detail?: string
    quote?: VaultRedemptionQuoteDTO
    redemption?: {
      id: number
      reference: string
      grams_charged: string
      final_invoice_inr: string
      product_name: string
      jeweller_name: string
    }
  }
  if (!res.ok) {
    const staleQuote =
      data.quote && typeof data.quote.product_id === 'number'
        ? (data.quote as VaultRedemptionQuoteDTO)
        : undefined
    return {
      ok: false,
      detail: data.detail != null ? String(data.detail) : 'Redemption failed.',
      staleQuote,
    }
  }
  if (!data.redemption || typeof data.redemption.id !== 'number') {
    return { ok: false, detail: data.detail ?? 'Unexpected response.' }
  }
  return {
    ok: true,
    detail: String(data.detail ?? 'OK'),
    redemption: data.redemption,
  }
}
