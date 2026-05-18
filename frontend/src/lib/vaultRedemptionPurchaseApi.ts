import { authFetch } from '@/lib/api'

export type VaultRedemptionQuoteDTO = {
  product_id: number
  product_name: string
  jeweller_id: number
  jeweller_name: string
  stock_quantity: number
  final_invoice_inr: string
  cash_payable_inr: string
  jeweller_subtotal_inr: string
  metal_rate_inr_per_gram: string
  grams_required: string
  grams_suggested_full_order: string
  vault_grams_available: string
  sufficient_vault: boolean
  vault_covers_full_order: boolean
  same_store: boolean
  cross_platform_fee_inr: string
  vault_metal_credit_inr: string
  gst_on_gold_saved_inr: string
  cash_only_final_invoice_inr: string
}

export type VaultRedemptionResultDTO = {
  id: number
  reference: string
  grams_charged: string
  final_invoice_inr: string
  cash_paid_inr: string
  cash_payment_method: string
  gst_on_gold_saved_inr: string
  product_name: string
  jeweller_name: string
}

export type CashPaymentMethod = 'counter_cash' | 'counter_upi' | 'card_demo'

export async function fetchVaultRedemptionQuote(
  productId: number,
  vaultGrams?: number,
): Promise<{ ok: true; data: VaultRedemptionQuoteDTO } | { ok: false; detail: string }> {
  const params = new URLSearchParams({ product_id: String(productId) })
  if (vaultGrams != null && Number.isFinite(vaultGrams)) {
    params.set('vault_grams', String(vaultGrams))
  }
  const res = await authFetch(`/api/v1/marketplace/redemption/quote/?${params.toString()}`)
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
  opts: {
    vaultGrams: number
    expected?: {
      final_invoice_inr: string
      cash_payable_inr: string
      grams_charged: string
    }
    cashPaymentMethod?: CashPaymentMethod | ''
  },
): Promise<
  | { ok: true; detail: string; redemption: VaultRedemptionResultDTO }
  | { ok: false; detail: string; staleQuote?: VaultRedemptionQuoteDTO }
> {
  const jsonBody: Record<string, unknown> = {
    product_id: productId,
    vault_grams: opts.vaultGrams,
  }
  if (opts.expected) {
    jsonBody.expected_final_invoice_inr = opts.expected.final_invoice_inr
    jsonBody.expected_cash_payable_inr = opts.expected.cash_payable_inr
    jsonBody.expected_grams_charged = opts.expected.grams_charged
  }
  if (opts.cashPaymentMethod) {
    jsonBody.cash_payment_method = opts.cashPaymentMethod
  }
  const res = await authFetch('/api/v1/marketplace/redemption/confirm/', {
    method: 'POST',
    jsonBody,
  })
  const data = (await res.json().catch(() => ({}))) as {
    detail?: string
    quote?: VaultRedemptionQuoteDTO
    redemption?: VaultRedemptionResultDTO
  }
  if (!res.ok) {
    const staleQuote =
      data.quote && typeof data.quote.product_id === 'number'
        ? (data.quote as VaultRedemptionQuoteDTO)
        : undefined
    return {
      ok: false,
      detail: data.detail != null ? String(data.detail) : 'Order could not be confirmed.',
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
