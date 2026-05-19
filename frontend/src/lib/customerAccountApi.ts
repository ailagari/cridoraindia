import { authFetch } from '@/lib/api'

export type CustomerBankAccountDTO = {
  account_holder_name: string
  account_number: string
  ifsc_code: string
  bank_name: string
  branch: string
  status: string
}

export type CustomerMeDetailsDTO = {
  id: number
  email: string
  first_name: string
  last_name: string
  phone: string
  kyc_status: string
  cridora_member_id: string
  bank_account: CustomerBankAccountDTO | null
}

function readDetail(data: Record<string, unknown>, fallback: string): string {
  const d = data.detail
  if (typeof d === 'string' && d) return d
  const parts: string[] = []
  for (const v of Object.values(data)) {
    if (Array.isArray(v) && v.length > 0) parts.push(String(v[0]))
    else if (typeof v === 'string' && v) parts.push(v)
  }
  return parts.join(' ') || fallback
}

export async function fetchCustomerMeDetails(): Promise<
  { ok: true; data: CustomerMeDetailsDTO } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/auth/me/')
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    return { ok: false, detail: readDetail(data, 'Could not load account details.') }
  }
  const bank = data.bank_account
  let bankAccount: CustomerBankAccountDTO | null = null
  if (bank && typeof bank === 'object') {
    const b = bank as Record<string, unknown>
    bankAccount = {
      account_holder_name: String(b.account_holder_name ?? ''),
      account_number: String(b.account_number ?? ''),
      ifsc_code: String(b.ifsc_code ?? ''),
      bank_name: String(b.bank_name ?? ''),
      branch: String(b.branch ?? ''),
      status: String(b.status ?? ''),
    }
  }
  return {
    ok: true,
    data: {
      id: Number(data.id),
      email: String(data.email ?? ''),
      first_name: String(data.first_name ?? ''),
      last_name: String(data.last_name ?? ''),
      phone: String(data.phone ?? ''),
      kyc_status: String(data.kyc_status ?? 'pending'),
      cridora_member_id: String(data.cridora_member_id ?? ''),
      bank_account: bankAccount,
    },
  }
}

export async function patchCustomerPersonalProfile(body: {
  first_name: string
  last_name: string
  phone: string
}): Promise<{ ok: true; data: CustomerMeDetailsDTO } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/customer/profile/', {
    method: 'PATCH',
    jsonBody: body,
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    return { ok: false, detail: readDetail(data, 'Could not save profile.') }
  }
  const bank = data.bank_account
  let bankAccount: CustomerBankAccountDTO | null = null
  if (bank && typeof bank === 'object') {
    const b = bank as Record<string, unknown>
    bankAccount = {
      account_holder_name: String(b.account_holder_name ?? ''),
      account_number: String(b.account_number ?? ''),
      ifsc_code: String(b.ifsc_code ?? ''),
      bank_name: String(b.bank_name ?? ''),
      branch: String(b.branch ?? ''),
      status: String(b.status ?? ''),
    }
  }
  return {
    ok: true,
    data: {
      id: Number(data.id),
      email: String(data.email ?? ''),
      first_name: String(data.first_name ?? ''),
      last_name: String(data.last_name ?? ''),
      phone: String(data.phone ?? ''),
      kyc_status: String(data.kyc_status ?? 'pending'),
      cridora_member_id: String(data.cridora_member_id ?? ''),
      bank_account: bankAccount,
    },
  }
}
