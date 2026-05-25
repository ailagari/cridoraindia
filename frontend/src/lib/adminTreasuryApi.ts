import { authFetch, apiUrl } from '@/lib/api'

export type TreasuryLedgerRow = {
  when: string
  feature: string
  feature_label?: string
  reference: string
  customer: string
  jeweller: string
  jeweller_id: number
  amount_inr: string
  platform_revenue_inr: string
  jeweller_revenue_inr: string
  status: string
  settlement_status: string
  detail: Record<string, unknown>
}

export type SettlementSummary = {
  jewellers_owe_platform_inr: Array<{
    jeweller_id: number
    name: string
    pending_inr: string
    period: string
  }>
  platform_owes_jewellers_inr: Array<{
    jeweller_id: number
    name: string
    net_credit_inr: string
  }>
  cross_jeweller_net: Array<{
    from_jeweller: string
    to_jeweller: string
    from_jeweller_id: number
    to_jeweller_id: number
    pending_inr: string
    grams: string
  }>
  platform_revenue_today_inr: string
  platform_revenue_mtd_inr: string
}

export type SettlementActivePayment = {
  id: number
  direction: string
  status: string
  amount_inr: string
  payment_method: 'upi' | 'otp'
  otp_expires_at: string | null
  otp_verified: boolean
}

export type JewellerSettlementSummary = {
  fees_accrued_inr: string
  platform_credit_inr: string
  in_flight_inr: string
  net_payable_inr: string
  net_credit_inr: string
  direction: 'pay' | 'receive' | 'clear'
  pending_platform_fee_inr: string
  period: string
  active_payment: SettlementActivePayment | null
}

export type SettlementPaymentRow = {
  id: number
  direction: string
  payment_method: 'upi' | 'otp'
  jeweller_id: number
  jeweller_name: string
  settlement_batch_id: number | null
  amount_inr: string
  status: string
  reference_note: string
  utr: string
  upi_utr?: string
  has_receipt: boolean
  receipt_url: string
  proof_file_url?: string
  otp_issued?: boolean
  otp_expires_at?: string | null
  otp_verified?: boolean
  confirmed_at: string | null
  rejection_reason: string
  upi_rejection_count?: number
  upi_last_rejection_remark?: string
  upi_fraud_reported?: boolean
  created_at: string
}

export type SettlementPaymentInitResponse = SettlementPaymentRow & {
  upi_payment_id: number
  otp?: string
  expires_at?: string
}

type ApiDetail = { detail?: string }

function treasuryPaymentsBase(role: 'admin' | 'jeweller'): string {
  return role === 'admin' ? '/api/v1/admin/treasury/payments' : '/api/v1/jeweller/treasury/payments'
}

export async function adminTreasuryLedger(params?: {
  feature?: string
  limit?: number
  offset?: number
}): Promise<{ ok: true; results: TreasuryLedgerRow[]; count: number } | { ok: false; detail: string }> {
  const q = new URLSearchParams()
  if (params?.feature) q.set('feature', params.feature)
  if (params?.limit != null) q.set('limit', String(params.limit))
  if (params?.offset != null) q.set('offset', String(params.offset))
  const res = await authFetch(`/api/v1/admin/treasury/ledger/?${q.toString()}`)
  const data = (await res.json().catch(() => ({}))) as {
    results?: TreasuryLedgerRow[]
    count?: number
    detail?: string
  }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load ledger' }
  }
  return { ok: true, results: data.results ?? [], count: data.count ?? 0 }
}

export async function adminTreasurySettlementSummary(): Promise<
  { ok: true; data: SettlementSummary } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/admin/treasury/settlement/summary/')
  const data = (await res.json().catch(() => ({}))) as SettlementSummary & ApiDetail
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load summary' }
  }
  return { ok: true, data: data as SettlementSummary }
}

export async function adminTreasuryPayments(): Promise<
  { ok: true; results: SettlementPaymentRow[] } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/admin/treasury/payments/')
  const data = (await res.json().catch(() => ({}))) as { results?: SettlementPaymentRow[]; detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load payments' }
  }
  return { ok: true, results: data.results ?? [] }
}

export async function adminTreasuryPaymentInitiate(body: {
  jeweller_id: number
  amount_inr: string
  payment_method: 'upi' | 'otp'
  direction?: 'platform_to_jeweller' | 'jeweller_to_platform'
}): Promise<{ ok: true; data: SettlementPaymentInitResponse } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/admin/treasury/payments/initiate/', {
    method: 'POST',
    jsonBody: body,
  })
  const data = (await res.json().catch(() => ({}))) as SettlementPaymentInitResponse & ApiDetail
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Initiate failed' }
  }
  return { ok: true, data }
}

export async function adminTreasuryPaymentConfirm(
  paymentId: number,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/admin/treasury/payments/${paymentId}/confirm/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json().catch(() => ({}))) as ApiDetail
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Confirm failed' }
  }
  return { ok: true }
}

export async function adminTreasuryPaymentReject(
  paymentId: number,
  reason: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/admin/treasury/payments/${paymentId}/reject/`, {
    method: 'POST',
    jsonBody: { reason },
  })
  const data = (await res.json().catch(() => ({}))) as ApiDetail
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Reject failed' }
  }
  return { ok: true }
}

export async function jewellerTreasurySummary(): Promise<
  { ok: true; data: JewellerSettlementSummary } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/jeweller/treasury/summary/')
  const data = (await res.json().catch(() => ({}))) as JewellerSettlementSummary & ApiDetail
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load summary' }
  }
  return { ok: true, data: data as JewellerSettlementSummary }
}

export async function jewellerTreasuryPayments(): Promise<
  { ok: true; results: SettlementPaymentRow[] } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/jeweller/treasury/payments/')
  const data = (await res.json().catch(() => ({}))) as { results?: SettlementPaymentRow[]; detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load payments' }
  }
  return { ok: true, results: data.results ?? [] }
}

export async function jewellerTreasuryPaymentInitiate(body: {
  amount_inr?: string
  payment_method: 'upi' | 'otp'
}): Promise<{ ok: true; data: SettlementPaymentInitResponse } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/jeweller/treasury/payments/initiate/', {
    method: 'POST',
    jsonBody: body,
  })
  const data = (await res.json().catch(() => ({}))) as SettlementPaymentInitResponse & ApiDetail
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Initiate failed' }
  }
  return { ok: true, data }
}

export async function settlementOtpIssue(
  paymentId: number,
  role: 'admin' | 'jeweller',
): Promise<{ ok: true; data: SettlementPaymentInitResponse } | { ok: false; detail: string }> {
  const res = await authFetch(`${treasuryPaymentsBase(role)}/${paymentId}/otp/issue/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json().catch(() => ({}))) as SettlementPaymentInitResponse & ApiDetail
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not issue OTP' }
  }
  return { ok: true, data }
}

export async function settlementOtpVerify(
  paymentId: number,
  otp: string,
  role: 'admin' | 'jeweller',
): Promise<{ ok: true; data: SettlementPaymentRow } | { ok: false; detail: string }> {
  const res = await authFetch(`${treasuryPaymentsBase(role)}/${paymentId}/otp/verify/`, {
    method: 'POST',
    jsonBody: { otp },
  })
  const data = (await res.json().catch(() => ({}))) as SettlementPaymentRow & ApiDetail
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'OTP verification failed' }
  }
  return { ok: true, data }
}

export function treasuryExportUrl(groupBy: string, from?: string, to?: string): string {
  const q = new URLSearchParams()
  q.set('group_by', groupBy)
  q.set('output', 'csv')
  if (from) q.set('from', from)
  if (to) q.set('to', to)
  return apiUrl(`/api/v1/admin/treasury/export/?${q.toString()}`)
}
