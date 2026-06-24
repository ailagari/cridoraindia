import { useMemo } from 'react'
import type { GoldTickerPayload, SpotPricesPayload } from '@/lib/marketplaceApi'
import { dailyGoldGreetingLine } from '@/content/cridoraVoice'

function resolve22kPerGram(
  spot: SpotPricesPayload | null,
  tickerFallback: GoldTickerPayload | null,
): number | null {
  const g22 = spot?.gold?.['22K']
  if (typeof g22 === 'number' && Number.isFinite(g22)) return g22
  const p = spot?.platform_base_inr_per_gram_22k
  if (p) {
    const n = Number.parseFloat(p)
    if (Number.isFinite(n)) return n
  }
  if (tickerFallback) {
    const n = Number.parseFloat(tickerFallback.platform_base_inr_per_gram_22k)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function DailyGoldGreeting(props: {
  spot: SpotPricesPayload | null
  tickerFallback: GoldTickerPayload | null
  hasHoldings: boolean
}) {
  const line = useMemo(() => {
    const rate22k = resolve22kPerGram(props.spot, props.tickerFallback)
    return dailyGoldGreetingLine({ rate22k, hasHoldings: props.hasHoldings })
  }, [props.spot, props.tickerFallback, props.hasHoldings])

  return (
    <p className="pf-daily-greeting" role="status">
      {line}
    </p>
  )
}
