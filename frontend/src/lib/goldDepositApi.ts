import { authFetch } from '@/lib/api'

export type GoldDepositJewellerBrief = {
  id: number
  business_name: string
  city: string
}

export type GoldDepositCustomerBrief = {
  id: number
  email: string
  name: string
  cridora_member_id: string
}

export type GoldDepositIntakeDTO = {
  id: number
  reference: string
  grams: string
  purity_karat: string
  reference_metal_inr_per_gram: string
  estimated_value_inr: string
  jeweller_note: string
  status: string
  created_at: string
  completed_at: string | null
  jeweller: GoldDepositJewellerBrief
  customer?: GoldDepositCustomerBrief
  otp_expires_at?: string | null
  otp?: string
  otp_ttl_seconds?: number
  otp_policy_seconds?: number
}

export async function jewellerGoldDepositCreate(body: {
  customer_id: number
  grams: string
  purity_karat?: string
  jeweller_note?: string
}): Promise<{ ok: true; data: GoldDepositIntakeDTO } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/jeweller/gold-deposit/intakes/', {
    method: 'POST',
    jsonBody: body as Record<string, string | number>,
  })
  const data = (await res.json().catch(() => ({}))) as GoldDepositIntakeDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not create intake' }
  }
  return { ok: true, data: data as GoldDepositIntakeDTO }
}

export type JewellerGoldDepositPendingRow = GoldDepositIntakeDTO & {
  customer: GoldDepositCustomerBrief
  otp_expires_at?: string | null
}

export async function jewellerGoldDepositPending(): Promise<JewellerGoldDepositPendingRow[]> {
  const res = await authFetch('/api/v1/jeweller/gold-deposit/pending/')
  if (!res.ok) return []
  const body = (await res.json()) as { results?: JewellerGoldDepositPendingRow[] }
  return body.results ?? []
}

export async function jewellerGoldDepositVerify(
  intakeId: number,
  otp: string,
): Promise<{ ok: true; data: GoldDepositIntakeDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/jeweller/gold-deposit/intakes/${intakeId}/verify/`, {
    method: 'POST',
    jsonBody: { otp: otp.trim() },
  })
  const data = (await res.json().catch(() => ({}))) as GoldDepositIntakeDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Verify failed' }
  }
  return { ok: true, data: data as GoldDepositIntakeDTO }
}

export async function customerGoldDepositList(): Promise<GoldDepositIntakeDTO[]> {
  const res = await authFetch('/api/v1/gold-deposit/intakes/')
  if (!res.ok) return []
  const body = (await res.json()) as { results?: GoldDepositIntakeDTO[] }
  return body.results ?? []
}

export async function customerGoldDepositIssueOtp(
  intakeId: number,
): Promise<{ ok: true; data: GoldDepositIntakeDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/gold-deposit/intakes/${intakeId}/counter-otp/`, {
    method: 'POST',
    jsonBody: {},
  })
  const data = (await res.json().catch(() => ({}))) as GoldDepositIntakeDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not issue OTP' }
  }
  return { ok: true, data: data as GoldDepositIntakeDTO }
}
