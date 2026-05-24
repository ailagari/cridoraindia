import { authFetch } from '@/lib/api'

export type UnifiedDeskCustomer = {
  name: string
  email: string
  member_id: string
}

export type UnifiedDeskRow = {
  id: string
  source_model: string
  source_id: number
  reference: string
  transaction_type: string
  type_label?: string
  customer: UnifiedDeskCustomer
  amount_inr: string
  grams: string
  payment_method: string
  method_label?: string
  otp_utr: string
  status: string
  status_raw: string
  platform_fee_inr: string
  created_at: string
  completed_at: string | null
  detail: Record<string, unknown>
  actions: string[]
}

export type UnifiedDeskResponse = {
  results: UnifiedDeskRow[]
  count: number
  bucket: string
  summary: {
    pending_count: number
    pending_action_count: number
  }
}

export async function jewellerUnifiedDeskTransactions(params: {
  bucket: 'pending' | 'completed' | 'cancelled'
  type?: string
  method?: string
  limit?: number
  offset?: number
}): Promise<{ ok: true; data: UnifiedDeskResponse } | { ok: false; detail: string }> {
  const q = new URLSearchParams()
  q.set('bucket', params.bucket)
  if (params.type) q.set('type', params.type)
  if (params.method) q.set('method', params.method)
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.offset != null) q.set('offset', String(params.offset))
  const res = await authFetch(`/api/v1/jeweller/desk/transactions/?${q.toString()}`)
  const data = (await res.json().catch(() => ({}))) as UnifiedDeskResponse & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load desk' }
  }
  return { ok: true, data: data as UnifiedDeskResponse }
}
