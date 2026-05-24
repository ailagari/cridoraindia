import { authFetch } from '@/lib/api'
import type { UnifiedDeskRow } from '@/lib/jewellerUnifiedDeskApi'

export type JewellerOnHoldResponse = {
  results: UnifiedDeskRow[]
  count: number
}

export async function jewellerOnHoldPayments(params?: {
  limit?: number
}): Promise<{ ok: true; data: JewellerOnHoldResponse } | { ok: false; detail: string }> {
  const q = new URLSearchParams()
  if (params?.limit != null) q.set('limit', String(params.limit))
  const res = await authFetch(`/api/v1/jeweller/desk/on-hold/${q.toString() ? `?${q.toString()}` : ''}`)
  const data = (await res.json().catch(() => ({}))) as JewellerOnHoldResponse & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load on-hold payments' }
  }
  return { ok: true, data: data as JewellerOnHoldResponse }
}

export function upiKindFromRow(row: UnifiedDeskRow): 'fractional' | 'cridorapay' | 'loan_repayment' | null {
  if (row.transaction_type === 'fractional') return 'fractional'
  if (row.transaction_type === 'cridorapay') return 'cridorapay'
  if (row.transaction_type === 'loan_repayment') return 'loan_repayment'
  return null
}

export type UpiSubmissionRow = {
  id: number
  proof_kind: string
  utr: string
  proof_file_url: string
  submitted_at: string
  rejection_remark: string
}

export function rowSubmissions(row: UnifiedDeskRow): UpiSubmissionRow[] {
  const raw = row.detail.submissions
  if (!Array.isArray(raw)) return []
  return raw as UpiSubmissionRow[]
}
