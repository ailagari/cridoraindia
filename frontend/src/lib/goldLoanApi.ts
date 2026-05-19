import { authFetch } from '@/lib/api'

export type GoldLoanOfferDTO = {
  jeweller_id: string
  jeweller_label: string
  is_primary_custodian?: string
  grams: string
  eligible_vault_balance_grams: string
  eligible_for_request: string
  ineligible_reason: string
  reference_metal_inr_per_gram: string
  ltv_percent: string
  collateral_value_inr: string
  gross_principal_inr: string
  processing_fee_percent: string
  processing_fee_inr: string
  net_disbursement_inr: string
  gross_loan_inr_per_gram?: string
  net_loan_inr_per_gram?: string
  gold_loan_interest_apr_percent: string
}

export type GoldLoanVaultRateDTO = {
  jeweller_id: string
  jeweller_label: string
  is_primary_custodian: string
  eligible_vault_balance_grams: string
  reference_metal_inr_per_gram: string
  ltv_percent: string
  gross_loan_inr_per_gram: string
  net_loan_inr_per_gram: string
  processing_fee_percent: string
  loan_available: string
  loan_unavailable_reason: string
}

export type GoldLoanCompareDTO = {
  grams: string
  offer_count: string
  eligible_offer_count: string
  skip_compare: string
  auto_selected_jeweller_id: string
  offers: GoldLoanOfferDTO[]
  vault_rates?: GoldLoanVaultRateDTO[]
  gold_loan_ltv_min_percent: string
  gold_loan_ltv_max_percent: string
  gold_loan_processing_fee_percent: string
  gold_loan_processing_fee_jeweller_share_percent: string
  gold_loan_interest_apr_percent: string
}

export type GoldLoanQuoteDTO = GoldLoanOfferDTO & {
  minimum_redeemable_grams: string
  processing_fee_jeweller_share_inr: string
  processing_fee_cridora_share_inr: string
}

export type GoldLoanOutstandingDTO = {
  id: number
  reference: string
  status: string
  jeweller_id: number
  jeweller_label: string
  grams: string
  collateral_value_inr: string
  ltv_percent: string
  gross_principal_inr: string
  processing_fee_percent: string
  processing_fee_inr: string
  net_disbursement_inr: string
  reference_metal_inr_per_gram: string
  created_at: string
  updated_at: string
}

export async function fetchGoldLoanVaultRates(): Promise<GoldLoanVaultRateDTO[] | null> {
  const res = await authFetch('/api/v1/gold/loans/vault-rates/')
  if (!res.ok) return null
  const j = (await res.json()) as { vault_rates?: GoldLoanVaultRateDTO[] }
  return j.vault_rates ?? []
}

export async function postGoldLoanCompare(
  grams: string,
): Promise<{ data: GoldLoanCompareDTO | null; detail: string }> {
  const res = await authFetch('/api/v1/gold/loans/compare/', {
    method: 'POST',
    jsonBody: { grams },
  })
  const j = (await res.json().catch(() => ({}))) as GoldLoanCompareDTO & { detail?: string }
  if (!res.ok) {
    return { data: null, detail: j.detail ?? 'Could not load loan offers from your vault jewellers.' }
  }
  return { data: j, detail: '' }
}

export async function postGoldLoanQuote(
  jewellerId: number,
  grams: string,
): Promise<{ data: GoldLoanQuoteDTO | null; detail: string }> {
  const res = await authFetch('/api/v1/gold/loans/quote/', {
    method: 'POST',
    jsonBody: { jeweller_id: jewellerId, grams },
  })
  const j = (await res.json().catch(() => ({}))) as GoldLoanQuoteDTO & { detail?: string }
  if (!res.ok) {
    return { data: null, detail: j.detail ?? 'Could not quote loan.' }
  }
  return { data: j, detail: '' }
}

export async function postGoldLoanConfirm(
  jewellerId: number,
  grams: string,
): Promise<{ data: GoldLoanOutstandingDTO | null; detail: string }> {
  const res = await authFetch('/api/v1/gold/loans/confirm/', {
    method: 'POST',
    jsonBody: { jeweller_id: jewellerId, grams },
  })
  const j = (await res.json().catch(() => ({}))) as GoldLoanOutstandingDTO & { detail?: string }
  if (!res.ok) {
    return { data: null, detail: j.detail ?? 'Could not submit loan request.' }
  }
  return { data: j, detail: '' }
}

export async function fetchGoldLoanOutstanding(): Promise<GoldLoanOutstandingDTO[] | null> {
  const res = await authFetch('/api/v1/gold/loans/outstanding/')
  if (!res.ok) return null
  return (await res.json()) as GoldLoanOutstandingDTO[]
}
