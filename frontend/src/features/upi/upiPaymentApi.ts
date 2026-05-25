import { apiUrl, authFetch, authUpload, extractApiDetail } from '@/lib/api'
import { customerCridoraPayCancel } from '@/lib/cridorapayApi'
import { fractionalCancelCounterOrder, fractionalCancelUpiOrder } from '@/lib/fractionalPurchaseApi'
import { postGoldLoanRepaymentCancel } from '@/lib/goldLoanApi'
import { customerCancelSellbackUpi } from '@/lib/goldTransferApi'
import { isValidUtr, utrValidationHint } from '@/lib/utrNormalize'

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

export async function submitUpiPaymentProof(
  kind: UpiPaymentKind,
  id: number,
  opts: { utr?: string; file?: File | null },
): Promise<ApiResult<UpiPaymentState>> {
  const utr = (opts.utr ?? '').trim()
  const file = opts.file ?? null
  const hasUtr = utr.length > 0
  const hasFile = Boolean(file)

  if (!hasUtr && !hasFile) {
    return { ok: false, detail: 'Enter a UTR number or upload a payment screenshot.' }
  }
  if (hasUtr && !isValidUtr(utr) && !hasFile) {
    return { ok: false, detail: utrValidationHint(utr) ?? 'Enter a valid UTR number.' }
  }
  if (hasFile) {
    return submitUpiProof(kind, id, file!, hasUtr && isValidUtr(utr) ? utr : undefined)
  }
  return submitUpiUtr(kind, id, utr)
}

export async function submitUpiUtr(
  kind: UpiPaymentKind,
  id: number,
  utr: string,
): Promise<ApiResult<UpiPaymentState>> {
  try {
    const res = await authFetch(`/api/v1/upi/${kind}/${id}/submit-utr/`, {
      method: 'POST',
      jsonBody: { utr },
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
      jsonBody: { remark, confirm: true },
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
      jsonBody: { note },
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

export const UPI_AUTO_CANCEL_STATUSES = new Set(['pending_payment', 'signal_received'])

export const FRACTIONAL_COUNTER_CANCEL_STATUSES = new Set(['awaiting_counter'])

export async function cancelFractionalOrder(
  orderId: number,
  paymentMethod: string,
  status: string,
): Promise<ApiResult<{ detail: string }>> {
  if (paymentMethod === 'upi' && UPI_AUTO_CANCEL_STATUSES.has(status)) {
    const out = await fractionalCancelUpiOrder(orderId)
    if (!out.ok) return out
    return { ok: true, data: { detail: 'Order cancelled.' } }
  }
  if (paymentMethod === 'counter' && FRACTIONAL_COUNTER_CANCEL_STATUSES.has(status)) {
    const out = await fractionalCancelCounterOrder(orderId)
    if (!out.ok) return out
    return { ok: true, data: { detail: 'Order cancelled.' } }
  }
  return { ok: false, detail: 'This order cannot be cancelled.' }
}

export async function cancelUpiPayment(
  kind: UpiPaymentKind,
  id: number,
): Promise<ApiResult<{ detail: string }>> {
  try {
    if (kind === 'fractional') {
      const out = await fractionalCancelUpiOrder(id)
      if (!out.ok) return out
      return { ok: true, data: { detail: 'Order cancelled.' } }
    }
    if (kind === 'loan_repayment') {
      const out = await postGoldLoanRepaymentCancel(id)
      if (!out.ok) return out
      return { ok: true, data: { detail: out.detail } }
    }
    if (kind === 'sellback') {
      const out = await customerCancelSellbackUpi(id)
      if (!out.ok) return out
      return { ok: true, data: { detail: 'Sellback cancelled.' } }
    }
    if (kind === 'cridorapay') {
      const out = await customerCridoraPayCancel(id)
      if (!out.ok) return out
      return { ok: true, data: { detail: 'Bill cancelled.' } }
    }
    return { ok: false, detail: 'Cannot cancel this payment type.' }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Network error.' }
  }
}

export function onHoldMessage(kind: UpiPaymentKind, contactName?: string): string {
  if (contactName?.trim()) {
    return `On HOLD: Contact: ${contactName.trim().toUpperCase()}`
  }
  if (kind === 'sellback') {
    return 'On HOLD: Contact: CUSTOMER'
  }
  return 'On HOLD: Contact: JEWELLER'
}
