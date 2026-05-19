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
  loan_collateral_locked_grams?: string
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
  gold_loan_max_term_months?: string
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
  payment_method?: string
  otp_expires_at?: string | null
  term_months?: number
  collateral_locked_grams?: string
  principal_outstanding_inr?: string
  due_at?: string | null
  created_at: string
  updated_at: string
}

export type GoldLoanActiveDTO = {
  id: number
  reference: string
  status: string
  jeweller_id: string
  jeweller_label: string
  grams: string
  collateral_locked_grams: string
  collateral_value_inr: string
  gross_principal_inr: string
  principal_paid_inr: string
  principal_outstanding_inr: string
  net_disbursement_inr: string
  term_months: string
  disbursed_at: string
  due_at: string
  created_at: string
  updated_at: string
}

export type GoldLoanAccountsDTO = {
  gold_loan_max_term_months: string
  pending: GoldLoanOutstandingDTO[]
  active: GoldLoanActiveDTO[]
}

export type JewellerLoanRowDTO = {
  id: number
  reference: string
  created_at: string
  updated_at: string
  customer_id: number
  customer_label: string
  customer_phone: string
  grams: string
  collateral_value_inr: string
  ltv_percent: string
  gross_principal_inr: string
  processing_fee_inr: string
  net_disbursement_inr: string
  status: string
  payment_method: string
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

export async function fetchGoldLoanAccounts(): Promise<GoldLoanAccountsDTO | null> {
  const res = await authFetch('/api/v1/gold/loans/accounts/')
  if (!res.ok) return null
  return (await res.json()) as GoldLoanAccountsDTO
}

export async function postGoldLoanRepay(
  loanId: number,
  amountInr: string,
): Promise<{ ok: true; detail: string; loan: GoldLoanActiveDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/gold/loans/${loanId}/repay/`, {
    method: 'POST',
    jsonBody: { amount_inr: amountInr },
  })
  const j = (await res.json().catch(() => ({}))) as {
    detail?: string
    loan?: GoldLoanActiveDTO
  }
  if (!res.ok || !j.loan) {
    return { ok: false, detail: j.detail ?? 'Repayment failed.' }
  }
  return { ok: true, detail: j.detail ?? 'Payment recorded.', loan: j.loan }
}

export async function postGoldLoanConfirm(
  jewellerId: number,
  grams: string,
  termMonths: number,
): Promise<
  | { ok: true; detail: string; loan: GoldLoanOutstandingDTO; otp_code?: string; otp_expires_at?: string }
  | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/gold/loans/confirm/', {
    method: 'POST',
    jsonBody: { jeweller_id: jewellerId, grams, term_months: termMonths },
  })
  const j = (await res.json().catch(() => ({}))) as {
    detail?: string
    loan?: GoldLoanOutstandingDTO
    otp_code?: string
    otp_expires_at?: string
  }
  if (!res.ok) {
    return { ok: false, detail: j.detail ?? 'Could not submit loan request.' }
  }
  if (!j.loan) {
    return { ok: false, detail: j.detail ?? 'Could not submit loan request.' }
  }
  return {
    ok: true,
    detail: j.detail ?? 'Loan submitted.',
    loan: j.loan,
    otp_code: j.otp_code,
    otp_expires_at: j.otp_expires_at,
  }
}

export async function fetchGoldLoanOutstanding(): Promise<GoldLoanOutstandingDTO[] | null> {
  const res = await authFetch('/api/v1/gold/loans/outstanding/')
  if (!res.ok) return null
  const j = (await res.json()) as { results?: GoldLoanOutstandingDTO[] }
  return j.results ?? []
}

export async function postGoldLoanOtpRegenerate(
  loanId: number,
): Promise<{ ok: true; otp_code: string; otp_expires_at: string } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/gold/loans/${loanId}/otp/regenerate/`, {
    method: 'POST',
    jsonBody: {},
  })
  const j = (await res.json().catch(() => ({}))) as {
    detail?: string
    otp_code?: string
    otp_expires_at?: string
  }
  if (!res.ok || !j.otp_code) {
    return { ok: false, detail: j.detail ?? 'Could not regenerate OTP.' }
  }
  return { ok: true, otp_code: j.otp_code, otp_expires_at: j.otp_expires_at ?? '' }
}

export async function fetchJewellerLoans(): Promise<{ results: JewellerLoanRowDTO[] } | null> {
  const res = await authFetch('/api/v1/jeweller/loans/')
  if (!res.ok) return null
  return (await res.json()) as { results: JewellerLoanRowDTO[] }
}

export async function postJewellerLoanAccept(
  loanId: number,
): Promise<{ ok: true; detail: string } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/loans/${loanId}/accept/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json()) as { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail ?? 'Could not accept.' }
  }
  return { ok: true, detail: data.detail ?? 'Accepted.' }
}

export async function postJewellerLoanReject(
  loanId: number,
): Promise<{ ok: true; detail: string } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/loans/${loanId}/reject/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json()) as { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail ?? 'Could not reject.' }
  }
  return { ok: true, detail: data.detail ?? 'Rejected.' }
}

export async function postJewellerLoanComplete(
  loanId: number,
  otp: string,
): Promise<{ ok: true; detail: string } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/loans/${loanId}/complete/`, {
    method: 'POST',
    jsonBody: { otp: otp.trim() },
  })
  const data = (await res.json()) as { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail ?? 'Could not complete loan.' }
  }
  return { ok: true, detail: data.detail ?? 'Loan disbursed.' }
}
