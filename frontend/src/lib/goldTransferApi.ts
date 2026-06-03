import { authFetch } from '@/lib/api'

export type VaultRowDTO = {
  vault_public_id: string
  custodian_id: number
  custodian_label: string
  is_primary_custodian?: boolean
  fractional_grams: string
  deposit_grams?: string
  golden_scheme_grams?: string
  vault_total_grams?: string
  jeweller_metal_rate_inr_per_gram?: string
  estimated_fractional_value_inr?: string
  estimated_deposit_value_inr?: string
  estimated_golden_scheme_value_inr?: string
  estimated_vault_value_inr?: string
  jeweller_metal_rate_last_updated_at?: string
}

export type FractionalLedgerRowDTO = {
  reference: string
  created_at: string
  jeweller_name: string
  grams: string
  /** Metal value before GST (matches portfolio allocated-cost basis). */
  gold_value_inr_pre_gst?: string
  total_inr: string
  payment_method: string
}

export type LiabilityCreditRowDTO = {
  grams: string
  created_at: string
  customer_member_id: string
  customer_label: string
  purchase_reference: string
}

/** purchase_basis_inr_total / allocated_cost_inr use metal ₹ before GST (not invoice total). */
export type PortfolioUnrealizedDTO = {
  market_value_inr: string
  allocated_cost_inr: string
  unrealized_pnl_inr: string
  unrealized_pnl_percent: string
  purchase_basis_inr_total?: string
  purchase_basis_grams_total?: string
  grams_allocated_for_cost?: string
  basis_note: string
}

/** Aggregated totals: Cridora vault grams/value + personal holdings (reference ₹/g). */
export type PortfolioTotalsDTO = {
  reference_gold_inr_per_gram_22k?: string
  reference_rate_source?: string
  total_gold_grams?: string
  personal_grams?: string
  vault_fractional_grams?: string
  vault_deposit_grams?: string
  vault_golden_scheme_grams?: string
  cridora_active_grams?: string
  cridora_estimated_value_inr?: string
  personal_estimated_value_inr?: string
  personal_recorded_cost_basis_inr?: string
  personal_gain_on_recorded_cost_inr?: string
  personal_gain_on_recorded_cost_percent?: string
  total_estimated_value_inr?: string
  loan_collateral_locked_grams?: string
  loan_principal_outstanding_inr?: string
}

export type GoldWalletDTO = {
  cridora_member_id: string
  cridora_global_id?: string
  merchant_cridora_id?: string
  gold_upi: string
  gold_handle_local: string
  jeweller_code: string
  default_jeweller_id: number | null
  secondary_jeweller_ids?: number[]
  jeweller_pref_nearby_id?: number | null
  jeweller_pref_ornament_id?: number | null
  jeweller_pref_redemption_id?: number | null
  balance_grams: string
  vaults?: VaultRowDTO[]
  /** Grams liability to customers (jeweller accounts only). */
  custodial_liability_grams?: string
  /** Completed fractional purchases (customer accounts). */
  fractional_ledger?: FractionalLedgerRowDTO[]
  /** Recent custodial liability credits (jeweller accounts). */
  recent_liability_credits?: LiabilityCreditRowDTO[]
  /** Customer unrealized P&L snapshot vs allocated fractional purchase cost. */
  portfolio_unrealized?: PortfolioUnrealizedDTO | null
  /** Full wealth view: vault + personal (reference marks). */
  portfolio_totals?: PortfolioTotalsDTO | null
  jeweller_total_revenue_inr?: string
  jeweller_revenue_by_kind?: Record<string, string>
  jeweller_portfolio?: {
    revenue_summary?: { total_revenue_inr?: string; by_kind?: Record<string, string> }
    loan_summary?: {
      active_loan_count?: number
      total_principal_outstanding_inr?: string
      pending_request_count?: number
    }
    loan_customers?: unknown[]
  }
}

/** Non-negative vaulted grams from wallet API (`balance_grams`) — sum across all custodians. */
export function walletBalanceGrams(w: GoldWalletDTO | null | undefined): number {
  if (!w) return 0
  const n = Number.parseFloat(w.balance_grams ?? '0')
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function sameCustodianJewellerId(a: number | string | undefined, b: number | string | undefined): boolean {
  const na = Number(a)
  const nb = Number(b)
  return Number.isFinite(na) && Number.isFinite(nb) && na > 0 && na === nb
}

/**
 * Grams the customer can apply at checkout for a listing from this custodian jeweller:
 * fractional + deposit + golden scheme (and transfers, which credit fractional), matching server debit order.
 * Capped by piece weight in UI, not here.
 */
export function vaultCheckoutEligibleGramsAtJeweller(
  w: GoldWalletDTO | null | undefined,
  jewellerId: number,
): number {
  const jid = Number(jewellerId)
  if (!w || !Number.isFinite(jid) || jid <= 0) return 0
  if (w.vaults?.length) {
    const row = w.vaults.find((v) => sameCustodianJewellerId(v.custodian_id, jid))
    if (row) return vaultRowTotalGrams(row)
  }
  const total = walletBalanceGrams(w)
  if (total > 1e-9 && w.default_jeweller_id != null && sameCustodianJewellerId(w.default_jeweller_id, jid)) {
    return total
  }
  return 0
}

/** Custodian jeweller IDs where the customer holds any positive vaulted grams. */
export function holdingsJewellerIdsFromWallet(w: GoldWalletDTO | null | undefined): ReadonlySet<number> {
  if (!w?.vaults?.length) return new Set<number>()
  const out = new Set<number>()
  for (const v of w.vaults) {
    const id = Number(v.custodian_id)
    if (!Number.isFinite(id) || id <= 0) continue
    if (vaultRowTotalGrams(v) > 1e-9) out.add(id)
  }
  return out
}

export type JewellerCustodyVaultRowDTO = {
  customer_id: number
  customer_member_id: string
  customer_label: string
  fractional_grams: string
  deposit_grams?: string
  golden_scheme_grams?: string
  vault_total_grams?: string
  jeweller_metal_rate_inr_per_gram?: string
  estimated_fractional_value_inr?: string
  estimated_total_vault_value_inr?: string
  jeweller_metal_rate_last_updated_at?: string
}

export type JewellerCustodyVaultsPayloadDTO = {
  results: JewellerCustodyVaultRowDTO[]
  /** All vaulted types (fractional + deposit + Golden scheme). */
  custodian_vault_grams_total?: string
  custodian_fractional_grams_total: string
  custodian_estimated_value_inr_total: string
}

export type JewellerVaultLedgerEntryDTO = {
  occurred_at: string
  transaction_type: string
  grams: string
  metal_type: string
  purchase_value_inr: string | null
  invoice_total_inr: string | null
  current_value_inr: string
  reference: string
  counterparty_label: string
}

export type JewellerVaultLedgerPayloadDTO = {
  customer_id: number
  reference_rate_inr_per_gram: string
  entries: JewellerVaultLedgerEntryDTO[]
}

export type GoldResolveRecipient = {
  gold_upi: string
  display_name: string
  user_type: string
  kyc_status: string
  jeweller_label: string
}

export type GoldResolveResponse = {
  found: boolean
  recipient?: GoldResolveRecipient
  detail?: string
  gold_upi?: string
  routing_kind?: string
  destination_custodian_id?: number
}

export async function fetchGoldWallet(): Promise<GoldWalletDTO | null> {
  const res = await authFetch('/api/v1/gold/wallet/')
  if (!res.ok) return null
  return (await res.json()) as GoldWalletDTO
}

export async function fetchJewellerCustodyVaults(): Promise<JewellerCustodyVaultsPayloadDTO | null> {
  const res = await authFetch('/api/v1/jeweller/custody-vaults/')
  if (!res.ok) return null
  return (await res.json()) as JewellerCustodyVaultsPayloadDTO
}

export type JewellerPrimaryCustomerRowDTO = {
  customer_id: number
  customer_member_id: string
  customer_label: string
  vault_total_grams: string
  estimated_total_vault_value_inr: string
}

export type JewellerPrimaryCustomersPayloadDTO = {
  results: JewellerPrimaryCustomerRowDTO[]
  primary_customer_count: number
  primary_vault_grams_total: string
  primary_estimated_value_inr_total: string
}

export async function fetchJewellerPrimaryCustomers(): Promise<JewellerPrimaryCustomersPayloadDTO | null> {
  const res = await authFetch('/api/v1/jeweller/primary-customers/')
  if (!res.ok) return null
  return (await res.json()) as JewellerPrimaryCustomersPayloadDTO
}

export async function fetchAdminJewellerPrimaryCustomers(
  jewellerId: number,
): Promise<JewellerPrimaryCustomersPayloadDTO | null> {
  const res = await authFetch(`/api/v1/admin/users/${jewellerId}/primary-customers/`)
  if (!res.ok) return null
  return (await res.json()) as JewellerPrimaryCustomersPayloadDTO
}

export async function fetchJewellerCustomerVaultLedger(
  customerId: number,
  filter?: string,
): Promise<JewellerVaultLedgerPayloadDTO | null> {
  const q = filter && filter !== 'all' ? `?filter=${encodeURIComponent(filter)}` : ''
  const res = await authFetch(`/api/v1/jeweller/custody-vaults/${customerId}/ledger/${q}`)
  if (!res.ok) return null
  return (await res.json()) as JewellerVaultLedgerPayloadDTO
}

export type SellbackQuoteDTO = {
  jeweller_id: number
  jeweller_label: string
  grams: string
  vault_balance_grams: string
  minimum_redeemable_grams: string
  reference_metal_inr_per_gram: string
  buyback_inr_per_gram: string
  cash_estimate_inr: string
  quote_input_mode: 'grams' | 'cash_inr'
  requested_cash_inr?: string
}

export type JewellerSellbackRowDTO = {
  id: number
  reference: string
  created_at: string
  updated_at: string
  customer_id: number
  customer_label: string
  customer_phone: string
  grams: string
  reference_metal_inr_per_gram_snapshot: string
  buyback_inr_per_gram_snapshot: string
  cash_estimate_inr: string
  payment_method: string
  payout_upi_vpa: string
  status: string
  upi_utr?: string
  utr_submitted_at?: string | null
}

export type SellbackPayoutPayload = {
  reference: string
  payee_vpa: string
  payee_name: string
  amount_inr: string
  payment_note: string
  upi_uri: string
  payout_expires_at: string | null
  expired: boolean
}

export type CustomerPayoutUpiProfileDTO = {
  payout_upi_vpa: string
  configured: boolean
}

export type SellbackOutstandingDTO = {
  id: number
  reference: string
  status: string
  payment_method: string
  payout_upi_vpa: string
  jeweller_label: string
  grams: string
  cash_estimate_inr: string
  buyback_inr_per_gram: string
  otp_expires_at: string | null
  upi_utr?: string
  utr_submitted_at?: string | null
  created_at: string
  updated_at: string
}

export async function postGoldSellbackQuote(
  jewellerId: number,
  body: { grams: string } | { cash_inr: string },
): Promise<{ ok: true; data: SellbackQuoteDTO } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/gold/sellback/quote/', {
    method: 'POST',
    jsonBody: { jeweller_id: jewellerId, ...body },
  })
  const data = (await res.json()) as SellbackQuoteDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail ?? 'Could not get quote.' }
  }
  return { ok: true, data: data as SellbackQuoteDTO }
}

export async function postGoldSellbackConfirm(
  jewellerId: number,
  grams: string,
  options?: { payment_method?: 'cash' | 'upi'; payout_upi_vpa?: string },
): Promise<
  | {
      ok: true
      wallet: GoldWalletDTO
      detail: string
      otp_code?: string
      otp_expires_at?: string
      sellback?: {
        id: number
        reference: string
        grams: string
        cash_estimate_inr: string
        status: string
        payment_method: string
        payout_upi_vpa: string
      }
    }
  | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/gold/sellback/confirm/', {
    method: 'POST',
    jsonBody: {
      jeweller_id: jewellerId,
      grams,
      payment_method: options?.payment_method ?? 'cash',
      payout_upi_vpa: options?.payout_upi_vpa ?? '',
    },
  })
  const data = (await res.json()) as {
    detail?: string
    wallet?: GoldWalletDTO
    otp_code?: string
    otp_expires_at?: string
    sellback?: {
      id: number
      reference: string
      grams: string
      cash_estimate_inr: string
      status: string
      payment_method: string
      payout_upi_vpa: string
    }
  }
  if (!res.ok) {
    return { ok: false, detail: data.detail ?? 'Sellback failed.' }
  }
  if (!data.wallet) {
    return { ok: false, detail: 'Unexpected response.' }
  }
  return {
    ok: true,
    wallet: data.wallet,
    detail: data.detail ?? 'Done.',
    otp_code: data.otp_code,
    otp_expires_at: data.otp_expires_at,
    sellback: data.sellback,
  }
}

export async function fetchSellbackOutstanding(): Promise<SellbackOutstandingDTO[] | null> {
  const res = await authFetch('/api/v1/gold/sellback/outstanding/')
  if (!res.ok) return null
  const data = (await res.json()) as { results?: SellbackOutstandingDTO[] }
  return data.results ?? []
}

export async function postSellbackOtpRegenerate(
  sellbackId: number,
): Promise<{ ok: true; otp_code: string; otp_expires_at: string } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/gold/sellback/${sellbackId}/otp/regenerate/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json()) as {
    detail?: string
    otp_code?: string
    otp_expires_at?: string
  }
  if (!res.ok || !data.otp_code) {
    return { ok: false, detail: data.detail ?? 'Could not regenerate OTP.' }
  }
  return { ok: true, otp_code: data.otp_code, otp_expires_at: data.otp_expires_at ?? '' }
}

export async function fetchJewellerSellbacks(): Promise<{ results: JewellerSellbackRowDTO[] } | null> {
  const res = await authFetch('/api/v1/jeweller/sellbacks/')
  if (!res.ok) return null
  return (await res.json()) as { results: JewellerSellbackRowDTO[] }
}

export async function postJewellerSellbackAccept(
  sellbackId: number,
): Promise<{ ok: true; detail: string } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/sellbacks/${sellbackId}/accept/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json()) as { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail ?? 'Could not accept.' }
  }
  return { ok: true, detail: data.detail ?? 'Accepted.' }
}

export async function postJewellerSellbackReject(
  sellbackId: number,
): Promise<{ ok: true; detail: string } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/sellbacks/${sellbackId}/reject/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json()) as { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail ?? 'Could not reject.' }
  }
  return { ok: true, detail: data.detail ?? 'Rejected.' }
}

export async function postJewellerSellbackComplete(
  sellbackId: number,
  otp: string,
): Promise<{ ok: true; detail: string } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/sellbacks/${sellbackId}/complete/`, {
    method: 'POST',
    jsonBody: { otp: otp.trim() },
  })
  const data = (await res.json()) as { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail ?? 'Could not complete.' }
  }
  return { ok: true, detail: data.detail ?? 'Completed.' }
}

export async function fetchCustomerPayoutUpiProfile(): Promise<
  { ok: true; data: CustomerPayoutUpiProfileDTO } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/customer/profile/payout-upi/')
  const data = (await res.json()) as CustomerPayoutUpiProfileDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load payout UPI.' }
  }
  return { ok: true, data: data as CustomerPayoutUpiProfileDTO }
}

export async function updateCustomerPayoutUpiProfile(body: {
  payout_upi_vpa: string
}): Promise<{ ok: true; data: CustomerPayoutUpiProfileDTO } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/customer/profile/payout-upi/', {
    method: 'PATCH',
    jsonBody: body,
  })
  const data = (await res.json()) as CustomerPayoutUpiProfileDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not save payout UPI.' }
  }
  return { ok: true, data: data as CustomerPayoutUpiProfileDTO }
}

export async function jewellerFetchSellbackPayout(
  sellbackId: number,
): Promise<
  | { ok: true; data: JewellerSellbackRowDTO & { payout: SellbackPayoutPayload } }
  | { ok: false; detail: string }
> {
  const res = await authFetch(`/api/v1/jeweller/sellbacks/${sellbackId}/payout/`)
  const data = (await res.json()) as JewellerSellbackRowDTO & { payout?: SellbackPayoutPayload; detail?: string }
  if (!res.ok || !data.payout) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load payout details.' }
  }
  return { ok: true, data: data as JewellerSellbackRowDTO & { payout: SellbackPayoutPayload } }
}

export async function jewellerSubmitSellbackUtr(
  sellbackId: number,
  utr: string,
): Promise<{ ok: true; data: JewellerSellbackRowDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/sellbacks/${sellbackId}/submit-utr/`, {
    method: 'POST',
    jsonBody: { utr: utr.trim() },
  })
  const data = (await res.json()) as JewellerSellbackRowDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not submit UTR.' }
  }
  return { ok: true, data: data as JewellerSellbackRowDTO }
}

export async function customerConfirmSellbackUtr(
  sellbackId: number,
): Promise<{ ok: true; detail: string; sellback: SellbackOutstandingDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/gold/sellback/${sellbackId}/confirm-utr/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json()) as { detail?: string; sellback?: SellbackOutstandingDTO }
  if (!res.ok || !data.sellback) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not confirm payout.' }
  }
  return { ok: true, detail: data.detail ?? 'Sellback settled.', sellback: data.sellback }
}

export async function customerCancelSellbackUpi(
  sellbackId: number,
): Promise<{ ok: true; data: SellbackOutstandingDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/gold/sellback/${sellbackId}/cancel-upi/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json()) as SellbackOutstandingDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not cancel sellback.' }
  }
  return { ok: true, data: data as SellbackOutstandingDTO }
}

export async function resolveGoldUPI(gold_upi: string): Promise<GoldResolveResponse> {
  const res = await authFetch('/api/v1/gold/resolve/', {
    method: 'POST',
    jsonBody: { gold_upi: gold_upi.trim() },
  })
  const data = (await res.json()) as GoldResolveResponse
  if (!res.ok) {
    return {
      found: false,
      detail:
        (data.detail != null ? String(data.detail) : null) ?? 'Could not resolve GoldUPI.',
    }
  }
  return data
}

export async function sendGoldTransfer(
  gold_upi: string,
  grams: string,
  from_custodian_id?: number | null,
): Promise<{ ok: true; wallet: GoldWalletDTO; detail: string } | { ok: false; detail: string }> {
  const body: Record<string, unknown> = { gold_upi: gold_upi.trim(), grams }
  if (from_custodian_id != null && Number.isFinite(from_custodian_id)) {
    body.from_custodian_id = from_custodian_id
  }
  const res = await authFetch('/api/v1/gold/transfers/', {
    method: 'POST',
    jsonBody: body,
  })
  const data = (await res.json()) as {
    detail?: string
    wallet?: GoldWalletDTO
  }
  if (!res.ok) {
    return { ok: false, detail: data.detail ?? 'Transfer failed' }
  }
  if (!data.wallet) {
    return { ok: false, detail: 'Unexpected response' }
  }
  return { ok: true, wallet: data.wallet, detail: data.detail ?? 'Sent.' }
}

function _parseVaultNum(s: string | undefined): number {
  if (s == null || String(s).trim() === '') return 0
  const n = Number.parseFloat(String(s))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

/** Total vaulted metal for one custodian row (fractional + deposit + scheme). */
export function vaultRowTotalGrams(v: VaultRowDTO): number {
  const vt = v.vault_total_grams
  if (vt != null && String(vt).trim() !== '') {
    const n = Number.parseFloat(String(vt))
    if (Number.isFinite(n)) return Math.max(0, n)
  }
  return (
    _parseVaultNum(v.fractional_grams) +
    _parseVaultNum(v.deposit_grams) +
    _parseVaultNum(v.golden_scheme_grams)
  )
}

/** Jeweller mark-to-market ₹ for all holding types in this vault row. */
export function vaultRowEstimatedInr(v: VaultRowDTO): number {
  const ev = v.estimated_vault_value_inr
  if (ev != null && String(ev).trim() !== '') {
    const n = Number.parseFloat(String(ev))
    if (Number.isFinite(n)) return Math.max(0, n)
  }
  return (
    _parseVaultNum(v.estimated_fractional_value_inr) +
    _parseVaultNum(v.estimated_deposit_value_inr) +
    _parseVaultNum(v.estimated_golden_scheme_value_inr)
  )
}
