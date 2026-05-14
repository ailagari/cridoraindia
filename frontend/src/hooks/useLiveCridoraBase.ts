import { useCallback, useEffect, useState } from 'react'
import { LIVE_PRICE_POLL_MS } from '@/lib/liveDeskIntervals'
import { fetchGoldTicker } from '@/lib/marketplaceApi'
import { useLivePoll } from '@/lib/useLivePoll'

export type LiveCridoraBase = {
  platformBaseInrPerGram22k: string
  source?: string
  updatedAt?: string
}

/**
 * Resolved Cridora 22K ₹/g from the gold-ticker API (HTTP polling while tab visible).
 */
export function useLiveCridoraBase(pollMs: number = LIVE_PRICE_POLL_MS) {
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
    void refresh()
  }, [refresh])

  useLivePoll(refresh, pollMs, true)

  return { data, refresh }
}
