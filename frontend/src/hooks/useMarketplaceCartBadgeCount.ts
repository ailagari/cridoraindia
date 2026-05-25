import { useEffect, useState } from 'react'
import {
  MARKETPLACE_CART_STORAGE_KEY,
  MARKETPLACE_CART_UPDATED_EVENT,
  cartItemCount,
  readMarketplaceCart,
} from '@/lib/marketplaceCartStorage'

/** Live item count (sum of quantities) for marketplace cart; updates same-tab and cross-tab. */
export function useMarketplaceCartBadgeCount(): number {
  const [n, setN] = useState(() => cartItemCount(readMarketplaceCart()))

  useEffect(() => {
    const sync = () => setN(cartItemCount(readMarketplaceCart()))
    const onStorage = (e: StorageEvent) => {
      if (e.key === MARKETPLACE_CART_STORAGE_KEY || e.key === null) sync()
    }
    window.addEventListener(MARKETPLACE_CART_UPDATED_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(MARKETPLACE_CART_UPDATED_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return n
}
