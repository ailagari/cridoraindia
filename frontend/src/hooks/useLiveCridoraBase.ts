import { useCallback, useEffect, useState } from 'react'
import { fetchGoldTicker } from '@/lib/marketplaceApi'

export type LiveCridoraBase = {
  platformBaseInrPerGram22k: string
  source?: string
  updatedAt?: string
}

const DEFAULT_POLL_MS = 60_000

/**
 * Resolved Cridora 22K ₹/g from the gold-ticker API (live spot / cache / admin fallback).
 */
export function useLiveCridoraBase(pollMs: number = DEFAULT_POLL_MS) {
  const [data, setData] = useState<LiveCridoraBase | null>(null)

  const refresh = useCallback(async () => {
    const t = await fetchGoldTicker()
    if (!t) {
      return
    }
    setData({
      platformBaseInrPerGram22k: t.platform_base_inr_per_gram_22k,
      source: t.cridora_base_source,
      updatedAt: t.updated_at,
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await refresh()
    })()
    const id = window.setInterval(() => {
      if (!cancelled) void refresh()
    }, pollMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [refresh, pollMs])

  return { data, refresh }
}
