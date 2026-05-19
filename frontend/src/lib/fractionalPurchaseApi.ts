import { authFetch } from '@/lib/api'

export type FractionalQuoteDTO = {
  jeweller: { id: number; business_name: string; city: string }
  metal_rate_inr_per_gram: string
  jeweller_metal_rate_last_updated_at: string
  grams: string
  gold_value_inr_pre_gst: string
  gst_percent: string
  gst_inr: string
  total_inr: string
}

export type FractionalPurchaseDTO = {
  id: number
  reference: string
  jeweller: { id: number; business_name: string; city: string }
  metal_rate_inr_per_gram: string
  grams: string
  gold_value_inr_pre_gst: string
  gst_percent: string
  gst_inr: string
  total_inr: string
  payment_method: string
  status: string
  customer_note: string
  created_at: string
  jeweller_verified_at: string | null
  payee_upi_vpa?: string
  payment_note?: string
  payment_expires_at?: string | null
  upi_utr?: string
  utr_submitted_at?: string | null
}

export type FractionalPaymentPayload = {
  reference: string
  payee_vpa: string
  payee_name: string
  amount_inr: string
  payment_note: string
  upi_uri: string
  payment_expires_at: string | null
  expired: boolean
}

export type FractionalCounterOtpResponseDTO = FractionalPurchaseDTO & {
  otp: string
  otp_expires_at: string
  otp_ttl_seconds?: number
}

export type JewellerUpiProfileDTO = {
  upi_vpa: string
  upi_display_name: string
  configured: boolean
}

export async function fractionalQuote(body: {
  jeweller_id: number
  mode: 'by_grams' | 'by_total_inr'
  grams?: string
  total_inr?: string
}): Promise<{ ok: true; data: FractionalQuoteDTO } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/fractional/quote/', {
    method: 'POST',
    jsonBody: body as Record<string, string | number>,
  })
  const data = (await res.json().catch(() => ({}))) as FractionalQuoteDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Quote failed' }
  }
  return { ok: true, data: data as FractionalQuoteDTO }
}

export async function fractionalCreateOrder(body: {
  jeweller_id: number
  payment_method: 'counter' | 'upi'
  mode: 'by_grams' | 'by_total_inr'
  grams?: string
  total_inr?: string
  customer_note?: string
}): Promise<{ ok: true; data: FractionalPurchaseDTO } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/fractional/orders/', {
    method: 'POST',
    jsonBody: body as Record<string, string | number>,
  })
  const data = (await res.json().catch(() => ({}))) as FractionalPurchaseDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Order failed' }
  }
  return { ok: true, data: data as FractionalPurchaseDTO }
}

export async function fractionalFetchPayment(
  orderId: number,
): Promise<
  | { ok: true; data: FractionalPurchaseDTO & { payment: FractionalPaymentPayload } }
  | { ok: false; detail: string }
> {
  const res = await authFetch(`/api/v1/fractional/orders/${orderId}/payment/`)
  const data = (await res.json().catch(() => ({}))) as FractionalPurchaseDTO & {
    payment?: FractionalPaymentPayload
    detail?: string
  }
  if (!res.ok || !data.payment) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load payment details' }
  }
  return { ok: true, data: data as FractionalPurchaseDTO & { payment: FractionalPaymentPayload } }
}

export async function fractionalSubmitUtr(
  orderId: number,
  utr: string,
): Promise<{ ok: true; data: FractionalPurchaseDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/fractional/orders/${orderId}/submit-utr/`, {
    method: 'POST',
    jsonBody: { utr: utr.trim() },
  })
  const data = (await res.json().catch(() => ({}))) as FractionalPurchaseDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not submit UTR' }
  }
  return { ok: true, data: data as FractionalPurchaseDTO }
}

export async function fractionalListOrders(): Promise<FractionalPurchaseDTO[]> {
  const res = await authFetch('/api/v1/fractional/orders/')
  if (!res.ok) return []
  const body = (await res.json()) as { results?: FractionalPurchaseDTO[] }
  return body.results ?? []
}

export async function fractionalIssueCounterOtp(
  orderId: number,
): Promise<{ ok: true; data: FractionalCounterOtpResponseDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/fractional/orders/${orderId}/counter-otp/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json().catch(() => ({}))) as FractionalCounterOtpResponseDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not issue OTP' }
  }
  return { ok: true, data: data as FractionalCounterOtpResponseDTO }
}

export async function fetchFractionalCounterOtpPolicy(): Promise<{ ok: true; otp_ttl_seconds: number } | { ok: false }> {
  const res = await authFetch('/api/v1/fractional/counter-otp-policy/')
  const data = (await res.json().catch(() => ({}))) as { otp_ttl_seconds?: number }
  if (!res.ok || typeof data.otp_ttl_seconds !== 'number' || !Number.isFinite(data.otp_ttl_seconds)) {
    return { ok: false }
  }
  return { ok: true, otp_ttl_seconds: data.otp_ttl_seconds }
}

export type JewellerFractionalPendingRow = FractionalPurchaseDTO & {
  customer: { email: string; name: string; cridora_member_id: string }
  otp_expires_at?: string | null
}

export type JewellerFractionalPendingUpiRow = FractionalPurchaseDTO & {
  customer: { email: string; name: string; cridora_member_id: string }
}

export async function jewellerFractionalPending(): Promise<JewellerFractionalPendingRow[]> {
  const res = await authFetch('/api/v1/jeweller/fractional/pending/')
  if (!res.ok) return []
  const body = (await res.json()) as { results?: JewellerFractionalPendingRow[] }
  return body.results ?? []
}

export async function jewellerFractionalPendingUpi(): Promise<JewellerFractionalPendingUpiRow[]> {
  const res = await authFetch('/api/v1/jeweller/fractional/pending-upi/')
  if (!res.ok) return []
  const body = (await res.json()) as { results?: JewellerFractionalPendingUpiRow[] }
  return body.results ?? []
}

export async function jewellerFractionalVerify(
  orderId: number,
  otp: string,
): Promise<{ ok: true; data: FractionalPurchaseDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/fractional/orders/${orderId}/verify/`, {
    method: 'POST',
    jsonBody: { otp: otp.trim() },
  })
  const data = (await res.json().catch(() => ({}))) as FractionalPurchaseDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Verify failed' }
  }
  return { ok: true, data: data as FractionalPurchaseDTO }
}

export async function jewellerFractionalConfirmUtr(
  orderId: number,
): Promise<{ ok: true; data: FractionalPurchaseDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/fractional/orders/${orderId}/confirm-utr/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json().catch(() => ({}))) as FractionalPurchaseDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Confirm failed' }
  }
  return { ok: true, data: data as FractionalPurchaseDTO }
}

export async function fetchJewellerUpiProfile(): Promise<
  { ok: true; data: JewellerUpiProfileDTO } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/jeweller/profile/upi/')
  const data = (await res.json().catch(() => ({}))) as JewellerUpiProfileDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load UPI profile' }
  }
  return { ok: true, data: data as JewellerUpiProfileDTO }
}

export async function updateJewellerUpiProfile(body: {
  upi_vpa: string
  upi_display_name?: string
}): Promise<{ ok: true; data: JewellerUpiProfileDTO } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/jeweller/profile/upi/', {
    method: 'PATCH',
    jsonBody: body,
  })
  const data = (await res.json().catch(() => ({}))) as JewellerUpiProfileDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not save UPI profile' }
  }
  return { ok: true, data: data as JewellerUpiProfileDTO }
}
