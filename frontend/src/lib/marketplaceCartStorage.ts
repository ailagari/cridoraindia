export const MARKETPLACE_CART_STORAGE_KEY = 'cridora_marketplace_cart_v1'

/** Same-tab updates (`storage` only fires across tabs). */
export const MARKETPLACE_CART_UPDATED_EVENT = 'cridora:marketplace-cart'

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
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MARKETPLACE_CART_UPDATED_EVENT))
    }
  } catch {
    /* ignore */
  }
}

export function cartItemCount(cart: Record<number, number>): number {
  let n = 0
  for (const v of Object.values(cart)) {
    n += v
  }
  return n
}

/** Open cart sheet while preserving `jeweller=` etc. when already on `/marketplace`. */
export function marketplaceListingCartHref(pathname: string, search: string): string {
  if (pathname === '/marketplace') {
    const n = new URLSearchParams(search)
    n.set('cart', '1')
    n.delete('checkout')
    const qs = n.toString()
    return qs ? `/marketplace?${qs}` : '/marketplace?cart=1'
  }
  return '/marketplace?cart=1'
}
