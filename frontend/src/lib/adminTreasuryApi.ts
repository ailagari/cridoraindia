import { authFetch, authUpload, apiUrl } from '@/lib/api'

export type TreasuryLedgerRow = {
  when: string
  feature: string
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

export type SettlementPaymentRow = {
  id: number
  direction: string
  jeweller_id: number
  jeweller_name: string
  settlement_batch_id: number | null
  amount_inr: string
  status: string
  reference_note: string
  utr: string
  has_receipt: boolean
  receipt_url: string
  confirmed_at: string | null
  rejection_reason: string
  created_at: string
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
  const data = (await res.json().catch(() => ({}))) as SettlementSummary & { detail?: string }
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

export async function adminTreasuryPaymentConfirm(
  paymentId: number,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/admin/treasury/payments/${paymentId}/confirm/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json().catch(() => ({}))) as { detail?: string }
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
  const data = (await res.json().catch(() => ({}))) as { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Reject failed' }
  }
  return { ok: true }
}

export async function jewellerTreasurySummary(): Promise<
  { ok: true; data: { pending_platform_fee_inr: string; period: string } } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/jeweller/treasury/summary/')
  const data = (await res.json().catch(() => ({}))) as {
    pending_platform_fee_inr?: string
    period?: string
    detail?: string
  }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load summary' }
  }
  return {
    ok: true,
    data: {
      pending_platform_fee_inr: data.pending_platform_fee_inr ?? '0',
      period: data.period ?? 'open',
    },
  }
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

export async function jewellerTreasuryPaymentSubmit(body: {
  amount_inr: string
  utr?: string
  reference_note?: string
  receipt_file: File
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  const fd = new FormData()
  fd.set('amount_inr', body.amount_inr)
  if (body.utr) fd.set('utr', body.utr)
  if (body.reference_note) fd.set('reference_note', body.reference_note)
  fd.set('receipt_file', body.receipt_file)
  const res = await authUpload('/api/v1/jeweller/treasury/payments/', fd)
  const data = (await res.json().catch(() => ({}))) as { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Submit failed' }
  }
  return { ok: true }
}

export function treasuryExportUrl(groupBy: string, from?: string, to?: string): string {
  const q = new URLSearchParams()
  q.set('group_by', groupBy)
  q.set('output', 'csv')
  if (from) q.set('from', from)
  if (to) q.set('to', to)
  return apiUrl(`/api/v1/admin/treasury/export/?${q.toString()}`)
}
