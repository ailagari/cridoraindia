import { apiFetch } from '@/lib/api'

export type JewellerReferralPreview = {
  valid: boolean
  referral_code: string
  jeweller_id: number
  business_name: string
  city: string
  state: string
}

export async function fetchJewellerReferralPreview(
  code: string,
): Promise<JewellerReferralPreview | null> {
  const digits = code.replace(/\D/g, '')
  if (digits.length < 1 || digits.length > 6) return null
  const padded = digits.padStart(6, '0')
  const res = await apiFetch(`/api/v1/public/jeweller-referral/${encodeURIComponent(padded)}/`)
  if (!res.ok) return null
  const data = (await res.json()) as JewellerReferralPreview
  return data.valid ? data : null
}
