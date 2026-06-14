import { fractionalIssueCounterOtp } from '@/lib/fractionalPurchaseApi'
import { issueSchemeCounterOtp } from '@/lib/schemesApi'
import {
  cancelFractionalOrder,
  cancelUpiPayment,
  FRACTIONAL_COUNTER_CANCEL_STATUSES,
  UPI_AUTO_CANCEL_STATUSES,
  type UpiPaymentKind,
} from '@/features/upi/upiPaymentApi'

export type CustomerPendingPayment = {
  id: number
  reference: string
  amount_inr: string
  payment_method: string
  status: string
  payment_expires_at?: string | null
}

export type CounterOtpReveal = {
  paymentId: number
  otp: string
  expiresAt: string
}

export const CUSTOMER_PAYMENT_METHODS = [
  { id: 'upi', label: 'Pay online (UPI)' },
  { id: 'counter', label: 'Pay at counter' },
] as const

export const CUSTOMER_INFLIGHT_UPI_STATUSES = new Set([
  'pending_payment',
  'signal_received',
  'pending_review',
  'needs_manual_verification',
  'awaiting_utr_verify',
  'proof_rejected',
  'on_hold',
])

export const CUSTOMER_RESUMABLE_UPI_STATUSES = new Set([
  'pending_payment',
  'signal_received',
  'proof_rejected',
])

export const CUSTOMER_COUNTER_ACTIVE_STATUS = 'awaiting_counter'

type ApiResult<T> = { ok: true; data: T } | { ok: false; detail: string }

export function formatCustomerPaymentInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function customerPaymentMethodHint(method: 'upi' | 'counter'): string {
  return method === 'upi'
    ? 'Pay via GPay / PhonePe · paste UTR after payment'
    : 'Pay at showroom · show OTP to jeweller'
}

export function isCustomerInflightUpi(row: Pick<CustomerPendingPayment, 'payment_method' | 'status'>): boolean {
  return row.payment_method === 'upi' && CUSTOMER_INFLIGHT_UPI_STATUSES.has(row.status)
}

export function isCustomerResumableUpi(row: Pick<CustomerPendingPayment, 'payment_method' | 'status'>): boolean {
  return row.payment_method === 'upi' && CUSTOMER_RESUMABLE_UPI_STATUSES.has(row.status)
}

export function isCustomerCounterAwaiting(row: Pick<CustomerPendingPayment, 'payment_method' | 'status'>): boolean {
  return row.payment_method === 'counter' && row.status === CUSTOMER_COUNTER_ACTIVE_STATUS
}

export function canCancelCustomerPayment(row: Pick<CustomerPendingPayment, 'payment_method' | 'status'>): boolean {
  if (row.payment_method === 'upi' && UPI_AUTO_CANCEL_STATUSES.has(row.status)) return true
  if (row.payment_method === 'counter' && FRACTIONAL_COUNTER_CANCEL_STATUSES.has(row.status)) return true
  return false
}

export async function issueCustomerCounterOtp(
  kind: Extract<UpiPaymentKind, 'fractional' | 'scheme'>,
  paymentId: number,
): Promise<ApiResult<CounterOtpReveal>> {
  if (kind === 'fractional') {
    const out = await fractionalIssueCounterOtp(paymentId)
    if (!out.ok) return out
    return {
      ok: true,
      data: {
        paymentId: out.data.id,
        otp: out.data.otp,
        expiresAt: out.data.otp_expires_at,
      },
    }
  }
  try {
    const data = await issueSchemeCounterOtp(paymentId)
    if (!data.otp || !data.otp_expires_at) {
      return { ok: false, detail: 'Could not issue OTP.' }
    }
    return {
      ok: true,
      data: {
        paymentId: data.id,
        otp: data.otp,
        expiresAt: data.otp_expires_at,
      },
    }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Could not issue OTP.' }
  }
}

export async function cancelCustomerPendingPayment(
  kind: Extract<UpiPaymentKind, 'fractional' | 'scheme'>,
  row: Pick<CustomerPendingPayment, 'id' | 'payment_method' | 'status'>,
): Promise<ApiResult<{ detail: string }>> {
  if (kind === 'fractional') {
    return cancelFractionalOrder(row.id, row.payment_method, row.status)
  }
  if (row.payment_method === 'upi' && UPI_AUTO_CANCEL_STATUSES.has(row.status)) {
    return cancelUpiPayment('scheme', row.id)
  }
  if (row.payment_method === 'counter' && FRACTIONAL_COUNTER_CANCEL_STATUSES.has(row.status)) {
    return cancelUpiPayment('scheme', row.id)
  }
  return { ok: false, detail: 'This payment cannot be cancelled.' }
}

export function customerPaymentPlacedMessage(
  row: Pick<CustomerPendingPayment, 'reference' | 'amount_inr' | 'payment_method'>,
): string {
  const amount = formatCustomerPaymentInr(row.amount_inr)
  if (row.payment_method === 'upi') {
    return `${row.reference} · Pay ₹${amount} via UPI, then paste UTR below.`
  }
  return `${row.reference} · Pay ₹${amount} at counter, then tap Generate OTP.`
}
