import type { FractionalPurchaseDTO } from '@/lib/fractionalPurchaseApi'
import type { GoldWalletDTO } from '@/lib/goldTransferApi'
import type { JewellerStorefrontDTO } from '@/lib/marketplaceApi'

export type FractionalJewellerOption = {
  id: number
  business_name: string
  city: string
  state: string
}

/** Customer primary jeweller from wallet (set at onboarding or in settings). */
export function customerDefaultJewellerId(wallet: GoldWalletDTO | null): number | null {
  const id = wallet?.default_jeweller_id
  return id != null && id > 0 ? id : null
}

export function jewellerOptionLabel(j: Pick<FractionalJewellerOption, 'business_name' | 'city' | 'state'>): string {
  const name = j.business_name.trim()
  const city = j.city.trim()
  const state = j.state.trim()
  if (!name) return city || state || 'Jeweller'
  if (city) return `${name} · ${city}`
  if (state) return `${name} · ${state}`
  return name
}

export function filterVerifiedJewellersByQuery(
  jewellers: JewellerStorefrontDTO[],
  query: string,
  limit = 8,
): JewellerStorefrontDTO[] {
  const q = query.trim().toLowerCase()
  const real = jewellers.filter((j) => j.id > 0)
  if (!q) {
    return [...real].sort((a, b) => jewellerOptionLabel(a).localeCompare(jewellerOptionLabel(b), 'en')).slice(0, limit)
  }
  const matches = real.filter(
    (j) =>
      j.business_name.toLowerCase().includes(q) ||
      j.city.toLowerCase().includes(q) ||
      j.state.toLowerCase().includes(q) ||
      j.shop_address.toLowerCase().includes(q),
  )
  return matches.sort((a, b) => jewellerOptionLabel(a).localeCompare(jewellerOptionLabel(b), 'en')).slice(0, limit)
}

/** Jeweller IDs for quick-pick chips: primary jeweller plus prior fractional custodians. */
export function knownFractionalJewellerIds(
  orders: FractionalPurchaseDTO[],
  wallet: GoldWalletDTO | null,
): number[] {
  const ids = new Set<number>()
  const defaultId = customerDefaultJewellerId(wallet)
  if (defaultId != null) ids.add(defaultId)
  for (const o of orders) {
    if (o.status === 'completed' && o.jeweller.id > 0) {
      ids.add(o.jeweller.id)
    }
  }
  for (const v of wallet?.vaults ?? []) {
    const id = Number(v.custodian_id)
    const frac = Number.parseFloat(v.fractional_grams ?? '0')
    if (Number.isFinite(id) && id > 0 && Number.isFinite(frac) && frac > 1e-9) {
      ids.add(id)
    }
  }
  return Array.from(ids)
}

export function resolveKnownFractionalJewellers(
  allJewellers: JewellerStorefrontDTO[],
  orders: FractionalPurchaseDTO[],
  knownIds: number[],
): FractionalJewellerOption[] {
  const byId = new Map<number, FractionalJewellerOption>()
  for (const j of allJewellers) {
    if (j.id > 0) {
      byId.set(j.id, {
        id: j.id,
        business_name: j.business_name,
        city: j.city,
        state: j.state,
      })
    }
  }
  const out: FractionalJewellerOption[] = []
  for (const id of knownIds) {
    const fromMarket = byId.get(id)
    if (fromMarket) {
      out.push(fromMarket)
      continue
    }
    const fromOrder = orders.find((o) => o.jeweller.id === id)
    if (fromOrder) {
      out.push({
        id: fromOrder.jeweller.id,
        business_name: fromOrder.jeweller.business_name,
        city: fromOrder.jeweller.city,
        state: '',
      })
    }
  }
  out.sort((a, b) => jewellerOptionLabel(a).localeCompare(jewellerOptionLabel(b), 'en'))
  return out
}

/** Primary jeweller by default; fallbacks only when primary is unset. */
export function preferredPaidFractionalJewellerId(
  orders: FractionalPurchaseDTO[],
  wallet: GoldWalletDTO | null,
  knownIds: number[],
): number | null {
  const defaultId = customerDefaultJewellerId(wallet)
  if (defaultId != null) return defaultId
  const known = new Set(knownIds)
  const completed = orders
    .filter((o) => o.status === 'completed' && known.has(o.jeweller.id))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  if (completed[0]) return completed[0].jeweller.id
  if (knownIds.length === 1) return knownIds[0]
  return knownIds[0] ?? null
}

type LoanOfferPick = {
  jeweller_id: string
  eligible_for_request: string
  is_primary_custodian?: string
}

/** Prefer primary custodian among eligible loan offers, else first eligible. */
export function pickPreferredLoanOffer<T extends LoanOfferPick>(
  offers: T[],
  defaultJewellerId: number | null,
): T | null {
  const eligible = offers.filter((o) => o.eligible_for_request === 'true')
  if (eligible.length === 0) return null
  if (defaultJewellerId != null) {
    const fromDefault = eligible.find((o) => Number.parseInt(o.jeweller_id, 10) === defaultJewellerId)
    if (fromDefault) return fromDefault
  }
  const primary = eligible.find((o) => o.is_primary_custodian === 'true')
  if (primary) return primary
  return eligible[0]
}

/** Prefer primary vault custodian when customer holds gold at multiple jewellers. */
export function preferredVaultCustodianId(
  wallet: GoldWalletDTO | null,
  custodianIds: number[],
): number | null {
  const defaultId = customerDefaultJewellerId(wallet)
  if (defaultId != null && custodianIds.includes(defaultId)) return defaultId
  if (custodianIds.length === 1) return custodianIds[0]
  return custodianIds[0] ?? null
}

export function parseJewellerIdFromUrl(raw: string | null): number | null {
  if (!raw) return null
  const id = Number.parseInt(raw, 10)
  return Number.isFinite(id) && id > 0 ? id : null
}
