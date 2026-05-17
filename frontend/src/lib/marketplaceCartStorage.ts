export const MARKETPLACE_CART_STORAGE_KEY = 'cridora_marketplace_cart_v1'

export function readMarketplaceCart(): Record<number, number> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(MARKETPLACE_CART_STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as Record<string, unknown>
    const out: Record<number, number> = {}
    for (const [k, v] of Object.entries(data)) {
      const id = Number.parseInt(k, 10)
      const q = typeof v === 'number' ? v : Number.parseInt(String(v), 10)
      if (Number.isFinite(id) && id > 0 && Number.isFinite(q) && q > 0) {
        out[id] = Math.min(9999, Math.floor(q))
      }
    }
    return out
  } catch {
    return {}
  }
}

export function writeMarketplaceCart(cart: Record<number, number>): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(MARKETPLACE_CART_STORAGE_KEY, JSON.stringify(cart))
  } catch {
    /* quota / private mode */
  }
}

export function cartItemCount(cart: Record<number, number>): number {
  let n = 0
  for (const v of Object.values(cart)) {
    n += v
  }
  return n
}
