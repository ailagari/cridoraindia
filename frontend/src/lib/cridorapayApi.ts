import { authFetch } from '@/lib/api'

async function readResponseJson<T extends object>(res: Response): Promise<T | null> {
  const text = await res.text()
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as T
  } catch {
    return null
  }
}

function parseApiDetail(parsed: Record<string, unknown> | null, res: Response, fallback: string): string {
  if (parsed) {
    const detail = parsed.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    const parts: string[] = []
    for (const v of Object.values(parsed)) {
      if (Array.isArray(v) && v.length > 0) parts.push(String(v[0]))
      else if (typeof v === 'string' && v) parts.push(v)
    }
    if (parts.length > 0) return parts.join(' ')
  }
  if (res.status === 404) {
    return 'CridoraPay bills API was not found (404). Refresh the page after the latest backend deploy.'
  }
  if (res.status === 403) return 'You do not have access to CridoraPay bills.'
  if (res.status >= 500) return `Server error loading bills (${res.status}). Try again shortly.`
  return `${fallback} (${res.status})`
}

export type CridoraPayJewellerBrief = {
  id: number
  business_name: string
  city: string
}

export type CridoraPayCustomerBrief = {
  id: number
  email: string
  name: string
  cridora_member_id: string
}

export type CridoraPayQuote = {
  bill_id: number
  reference: string
  title: string
  weight_grams: string
  total_inr: string
  metal_rate_inr_per_gram: string
  status: string
  payment_method: string
  vault_grams_available: string
  vault_grams_max: string
  vault_grams_chosen: string
  vault_inr_applied: string
  cash_payable_inr: string
  vault_covers_full_bill: boolean
  jeweller_id: number
  jeweller_name: string
}

export type CridoraPayBillDTO = {
  id: number
  reference: string
  title: string
  category: string
  weight_grams: string
  purity: string
  total_inr: string
  metal_rate_inr_per_gram: string
  jeweller_note: string
  status: string
  payment_method: string
  vault_grams_chosen: string
  vault_inr_applied: string
  cash_payable_inr: string
  payee_upi_vpa: string
  payment_note: string
  personal_holding_id: number | null
  expires_at: string | null
  completed_at: string | null
  created_at: string
  jeweller: CridoraPayJewellerBrief
  customer?: CridoraPayCustomerBrief
  quote?: CridoraPayQuote
  otp_expires_at?: string | null
  otp?: string
  otp_policy_seconds?: number
}

export async function jewellerCridoraPayCreate(body: {
  customer_id: number
  weight_grams: string
  total_inr: string
  title?: string
  category?: string
  purity?: string
  jeweller_note?: string
}): Promise<{ ok: true; data: CridoraPayBillDTO } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/jeweller/cridorapay/bills/', {
    method: 'POST',
    jsonBody: body as Record<string, string | number>,
  })
  const data = (await res.json().catch(() => ({}))) as CridoraPayBillDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not create bill' }
  }
  return { ok: true, data: data as CridoraPayBillDTO }
}

export async function jewellerCridoraPayList(
  status: 'open' | 'all' | string = 'open',
): Promise<{ ok: true; results: CridoraPayBillDTO[] } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/cridorapay/bills/list/?status=${encodeURIComponent(status)}`)
  const data = await readResponseJson<{ results?: CridoraPayBillDTO[]; detail?: string }>(res)
  if (!res.ok) {
    return { ok: false, detail: parseApiDetail(data, res, 'Could not load bills') }
  }
  return { ok: true, results: data?.results ?? [] }
}

export async function jewellerCridoraPayResendNotify(
  billId: number,
): Promise<{ ok: true; data: CridoraPayBillDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/cridorapay/bills/${billId}/resend-notify/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json().catch(() => ({}))) as CridoraPayBillDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not notify customer' }
  }
  return { ok: true, data: data as CridoraPayBillDTO }
}

export async function jewellerCridoraPayVerifyVaultOtp(
  billId: number,
  otp: string,
): Promise<{ ok: true; data: CridoraPayBillDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/cridorapay/bills/${billId}/verify-vault-otp/`, {
    method: 'POST',
    jsonBody: { otp: otp.trim() },
  })
  const data = (await res.json().catch(() => ({}))) as CridoraPayBillDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Verify failed' }
  }
  return { ok: true, data: data as CridoraPayBillDTO }
}

export async function jewellerCridoraPayMarkUpiPaid(
  billId: number,
): Promise<{ ok: true; data: CridoraPayBillDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/cridorapay/bills/${billId}/mark-upi-paid/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json().catch(() => ({}))) as CridoraPayBillDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not mark paid' }
  }
  return { ok: true, data: data as CridoraPayBillDTO }
}

export async function jewellerCridoraPayMarkCashPaid(
  billId: number,
): Promise<{ ok: true; data: CridoraPayBillDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/cridorapay/bills/${billId}/mark-cash-paid/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json().catch(() => ({}))) as CridoraPayBillDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not mark paid' }
  }
  return { ok: true, data: data as CridoraPayBillDTO }
}

export async function customerCridoraPayList(
  scope: 'all' | 'active' = 'all',
): Promise<{ ok: true; results: CridoraPayBillDTO[] } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/cridorapay/bills/?scope=${encodeURIComponent(scope)}`)
  const data = await readResponseJson<{ results?: CridoraPayBillDTO[]; detail?: string }>(res)
  if (!res.ok) {
    return { ok: false, detail: parseApiDetail(data, res, 'Could not load bills') }
  }
  return { ok: true, results: data?.results ?? [] }
}

export async function customerCridoraPayQuote(
  billId: number,
  vaultGrams?: string,
): Promise<{ ok: true; data: CridoraPayQuote } | { ok: false; detail: string }> {
  const q = vaultGrams != null && vaultGrams !== '' ? `?vault_grams=${encodeURIComponent(vaultGrams)}` : ''
  const res = await authFetch(`/api/v1/cridorapay/bills/${billId}/quote${q}`)
  const data = (await res.json().catch(() => ({}))) as CridoraPayQuote & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Quote failed' }
  }
  return { ok: true, data: data as CridoraPayQuote }
}

export async function customerCridoraPayAccept(
  billId: number,
  body: {
    payment_method: 'vault' | 'upi'
    vault_grams?: string
    expected_vault_grams_chosen?: string
    expected_cash_payable_inr?: string
  },
): Promise<{ ok: true; data: CridoraPayBillDTO } | { ok: false; detail: string; quote?: CridoraPayQuote }> {
  const res = await authFetch(`/api/v1/cridorapay/bills/${billId}/accept/`, {
    method: 'POST',
    jsonBody: body as Record<string, string>,
  })
  const data = (await res.json().catch(() => ({}))) as CridoraPayBillDTO & {
    detail?: string
    quote?: CridoraPayQuote
  }
  if (!res.ok) {
    return {
      ok: false,
      detail: data.detail != null ? String(data.detail) : 'Could not accept bill',
      quote: data.quote,
    }
  }
  return { ok: true, data: data as CridoraPayBillDTO }
}

export async function customerCridoraPayIssueVaultOtp(
  billId: number,
): Promise<{ ok: true; data: CridoraPayBillDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/cridorapay/bills/${billId}/vault-otp/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json().catch(() => ({}))) as CridoraPayBillDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not issue OTP' }
  }
  return { ok: true, data: data as CridoraPayBillDTO }
}

export async function customerCridoraPayCancel(
  billId: number,
): Promise<{ ok: true; data: CridoraPayBillDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/cridorapay/bills/${billId}/cancel/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json().catch(() => ({}))) as CridoraPayBillDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not cancel' }
  }
  return { ok: true, data: data as CridoraPayBillDTO }
}
