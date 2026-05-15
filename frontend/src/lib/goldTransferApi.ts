import { authFetch } from '@/lib/api'

export type VaultRowDTO = {
  vault_public_id: string
  custodian_id: number
  custodian_label: string
  fractional_grams: string
  jeweller_metal_rate_inr_per_gram?: string
  estimated_fractional_value_inr?: string
  jeweller_metal_rate_last_updated_at?: string
}

export type FractionalLedgerRowDTO = {
  reference: string
  created_at: string
  jeweller_name: string
  grams: string
  total_inr: string
  payment_method: string
}

export type LiabilityCreditRowDTO = {
  grams: string
  created_at: string
  customer_member_id: string
  customer_label: string
  purchase_reference: string
}

export type GoldWalletDTO = {
  cridora_member_id: string
  cridora_global_id?: string
  merchant_cridora_id?: string
  gold_upi: string
  gold_handle_local: string
  jeweller_code: string
  default_jeweller_id: number | null
  jeweller_pref_nearby_id?: number | null
  jeweller_pref_ornament_id?: number | null
  jeweller_pref_redemption_id?: number | null
  balance_grams: string
  vaults?: VaultRowDTO[]
  /** Grams liability to customers (jeweller accounts only). */
  custodial_liability_grams?: string
  /** Completed fractional purchases (customer accounts). */
  fractional_ledger?: FractionalLedgerRowDTO[]
  /** Recent custodial liability credits (jeweller accounts). */
  recent_liability_credits?: LiabilityCreditRowDTO[]
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
