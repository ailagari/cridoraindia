import { apiUrl, authFetch, authUpload, extractApiDetail } from '@/lib/api'

export type UpiPaymentKind =
  | 'fractional'
  | 'loan_repayment'
  | 'cridorapay'
  | 'sellback'
  | 'settlement'

export type UpiPaymentState = {
  kind: UpiPaymentKind
  id: number
  status: string
  reference?: string
  amount_inr?: string
  payee_vpa?: string
  payee_name?: string
  upi_uri?: string
  payment_note?: string
  expires_at?: string | null
  expired?: boolean
  upi_utr?: string
  proof_file_url?: string
  rejection_count?: number
  last_rejection_remark?: string
  fraud_reported?: boolean
  can_submit_proof?: boolean
  can_review?: boolean
  is_on_hold?: boolean
  is_completed?: boolean
  submissions?: Array<{
    id: number
    proof_kind: string
    utr: string
    proof_file_url: string
    submitted_at: string
    rejection_remark: string
  }>
}

export type UpiFraudReportRow = {
  id: number
  kind: string
  object_id: number
  reference: string
  amount_inr: string
  note: string
  status: string
  reported_by_email: string
  reported_by_name: string
  created_at: string
  reviewed_at: string | null
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; detail: string }

async function parseJson<T>(res: Response, fallback: string): Promise<ApiResult<T>> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    return { ok: false, detail: extractApiDetail(body, fallback) }
  }
  return { ok: true, data: body as T }
}

export async function fetchUpiPayment(
  kind: UpiPaymentKind,
  id: number,
): Promise<ApiResult<UpiPaymentState>> {
  try {
    const res = await authFetch(`/api/v1/upi/${kind}/${id}/payment/`)
    return parseJson(res, 'Could not load payment details.')
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Network error.' }
  }
}

export async function submitUpiUtr(
  kind: UpiPaymentKind,
  id: number,
  utr: string,
): Promise<ApiResult<UpiPaymentState>> {
  try {
    const res = await authFetch(`/api/v1/upi/${kind}/${id}/submit-utr/`, {
      method: 'POST',
      body: JSON.stringify({ utr }),
    })
    return parseJson(res, 'Could not submit UTR.')
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Network error.' }
  }
}

export async function submitUpiProof(
  kind: UpiPaymentKind,
  id: number,
  file: File,
  utr?: string,
): Promise<ApiResult<UpiPaymentState>> {
  const fd = new FormData()
  fd.append('proof_file', file)
  if (utr?.trim()) fd.append('utr', utr.trim())
  try {
    const res = await authUpload(`/api/v1/upi/${kind}/${id}/submit-proof/`, fd)
    return parseJson(res, 'Could not upload payment proof.')
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Network error.' }
  }
}

export async function approveUpiPayment(
  kind: UpiPaymentKind,
  id: number,
): Promise<ApiResult<UpiPaymentState>> {
  try {
    const res = await authFetch(`/api/v1/upi/${kind}/${id}/approve/`, { method: 'POST' })
    return parseJson(res, 'Could not approve payment.')
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Network error.' }
  }
}

export async function rejectUpiPayment(
  kind: UpiPaymentKind,
  id: number,
  remark: string,
): Promise<ApiResult<UpiPaymentState>> {
  try {
    const res = await authFetch(`/api/v1/upi/${kind}/${id}/reject/`, {
      method: 'POST',
      body: JSON.stringify({ remark, confirm: true }),
    })
    return parseJson(res, 'Could not reject payment.')
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Network error.' }
  }
}

export async function reportUpiFraud(
  kind: UpiPaymentKind,
  id: number,
  note: string,
): Promise<ApiResult<UpiPaymentState>> {
  try {
    const res = await authFetch(`/api/v1/upi/${kind}/${id}/report-fraud/`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    })
    return parseJson(res, 'Could not report fraud.')
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Network error.' }
  }
}

export async function fetchAdminUpiFraudReports(
  status = 'open',
): Promise<ApiResult<{ results: UpiFraudReportRow[] }>> {
  try {
    const res = await authFetch(`/api/v1/admin/treasury/fraud-reports/?status=${encodeURIComponent(status)}`)
    return parseJson(res, 'Could not load fraud reports.')
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Network error.' }
  }
}

export async function reviewAdminUpiFraudReport(id: number): Promise<ApiResult<UpiFraudReportRow>> {
  try {
    const res = await authFetch(`/api/v1/admin/treasury/fraud-reports/${id}/review/`, { method: 'POST' })
    return parseJson(res, 'Could not mark report reviewed.')
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Network error.' }
  }
}

export function upiProofImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return apiUrl(url)
}

export const UPI_PENDING_REVIEW = 'pending_review'
export const UPI_PROOF_REJECTED = 'proof_rejected'
export const UPI_ON_HOLD = 'on_hold'

export function onHoldMessage(kind: UpiPaymentKind): string {
  if (kind === 'sellback') {
    return 'This payout is on hold after two rejected proofs. Visit the customer in person to resolve.'
  }
  return 'This payment is on hold after two rejected proofs. Visit your jeweller in person to resolve.'
}
