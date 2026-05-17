import { useCallback, useEffect, useRef, useState } from 'react'
import type { MarketplaceProductDTO } from '@/lib/marketplaceApi'
import {
  MARKETPLACE_CART_STORAGE_KEY,
  cartItemCount,
  readMarketplaceCart,
  writeMarketplaceCart,
} from '@/lib/marketplaceCartStorage'
import { maxOrderQtyForProduct } from '@/lib/marketplacePricing'

export function useMarketplaceCart() {
  const [qtyById, setQtyById] = useState<Record<number, number>>(readMarketplaceCart)
  const qtyRef = useRef(qtyById)
  qtyRef.current = qtyById

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === MARKETPLACE_CART_STORAGE_KEY) setQtyById(readMarketplaceCart())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const replaceCart = useCallback((next: Record<number, number>) => {
    qtyRef.current = next
    writeMarketplaceCart(next)
    setQtyById(next)
  }, [])

  const addToCart = useCallback((p: MarketplaceProductDTO, delta: number = 1): { ok: boolean; qty: number; message: string } => {
    const max = maxOrderQtyForProduct(p)
    const cur = qtyRef.current[p.id] ?? 0
    const step = Math.max(1, Math.floor(delta))
    const nxt = Math.min(max, cur + step)
    if (cur >= max && nxt === cur) {
      return { ok: false, qty: cur, message: `Maximum ${max} in cart for this listing (stock / limit).` }
    }
    const next = { ...qtyRef.current, [p.id]: nxt }
    replaceCart(next)
    return { ok: true, qty: nxt, message: nxt > cur ? `Added to cart · ${p.name} · Qty ${nxt}` : `${p.name} · Qty ${nxt}` }
  }, [replaceCart])

  const setLineQty = useCallback((p: MarketplaceProductDTO, qty: number) => {
    const max = maxOrderQtyForProduct(p)
    const q = Math.max(0, Math.min(max, Math.floor(qty)))
    const next = { ...qtyRef.current }
    if (q < 1) {
      delete next[p.id]
    } else {
      next[p.id] = q
    }
    replaceCart(next)
  }, [replaceCart])

  const removeLine = useCallback((productId: number) => {
    const next = { ...qtyRef.current }
    delete next[productId]
    replaceCart(next)
  }, [replaceCart])

  const clearCart = useCallback(() => {
    replaceCart({})
  }, [replaceCart])

  const count = cartItemCount(qtyById)

  return {
    qtyById,
    cartItemCount: count,
    addToCart,
    setLineQty,
    removeLine,
    clearCart,
    replaceCart,
  }
}
