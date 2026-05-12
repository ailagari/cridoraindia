import { authFetch } from '@/lib/api'

export type GoldWalletDTO = {
  cridora_member_id: string
  gold_upi: string
  gold_handle_local: string
  jeweller_code: string
  default_jeweller_id: number | null
  balance_grams: string
}

export type GoldResolveRecipient = {
  gold_upi: string
  display_name: string
  user_type: string
  kyc_status: string
  jeweller_label: string
}

export async function fetchGoldWallet(): Promise<GoldWalletDTO | null> {
  const res = await authFetch('/api/v1/gold/wallet/')
  if (!res.ok) return null
  return (await res.json()) as GoldWalletDTO
}

export async function resolveGoldUPI(gold_upi: string): Promise<{
  found: boolean
  recipient?: GoldResolveRecipient
  detail?: string
  gold_upi?: string
}> {
  const res = await authFetch('/api/v1/gold/resolve/', {
    method: 'POST',
    jsonBody: { gold_upi: gold_upi.trim() },
  })
  const data = (await res.json()) as {
    found?: boolean
    recipient?: GoldResolveRecipient
    detail?: string
    gold_upi?: string
  }
  if (!res.ok) {
    return {
      found: false,
      detail:
        (data.detail != null ? String(data.detail) : null) ?? 'Could not resolve GoldUPI.',
    }
  }
  return data as {
    found: boolean
    recipient?: GoldResolveRecipient
    detail?: string
    gold_upi?: string
  }
}

export async function sendGoldTransfer(
  gold_upi: string,
  grams: string,
): Promise<{ ok: true; wallet: GoldWalletDTO; detail: string } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/gold/transfers/', {
    method: 'POST',
    jsonBody: { gold_upi: gold_upi.trim(), grams },
  })
  const data = (await res.json()) as {
    detail?: string
    wallet?: GoldWalletDTO
  }
  if (!res.ok) {
    return { ok: false, detail: data.detail ?? 'Transfer failed' }
  }
  if (!data.wallet) {
    return { ok: false, detail: 'Unexpected response' }
  }
  return { ok: true, wallet: data.wallet, detail: data.detail ?? 'Sent.' }
}
