import { apiUrl } from '@/lib/api'

export type PlatformBillingTaxPayload = {
  gst_on_gold_percent: string
  gst_on_making_percent: string
}

export const DEFAULT_GST_ON_GOLD_PERCENT = 3
export const DEFAULT_GST_ON_MAKING_PERCENT = 5

let cached: PlatformBillingTaxPayload | null = null
let inflight: Promise<PlatformBillingTaxPayload | null> | null = null

function parsePercent(raw: string | undefined, fallback: number): number {
  const n = Number.parseFloat(String(raw ?? ''))
  return Number.isFinite(n) ? n : fallback
}

export function resolveGstOnGoldPercent(): number {
  return cached ? parsePercent(cached.gst_on_gold_percent, DEFAULT_GST_ON_GOLD_PERCENT) : DEFAULT_GST_ON_GOLD_PERCENT
}

export function resolveGstOnMakingPercent(): number {
  return cached
    ? parsePercent(cached.gst_on_making_percent, DEFAULT_GST_ON_MAKING_PERCENT)
    : DEFAULT_GST_ON_MAKING_PERCENT
}

export function clearPlatformBillingTaxCache(): void {
  cached = null
  inflight = null
}

export async function fetchPlatformBillingTax(force = false): Promise<PlatformBillingTaxPayload | null> {
  if (cached && !force) return cached
  if (inflight && !force) return inflight

  inflight = (async () => {
    try {
      const res = await fetch(apiUrl('/api/v1/platform/billing-tax/'))
      const data = (await res.json().catch(() => ({}))) as PlatformBillingTaxPayload & {
        detail?: string
      }
      if (!res.ok || data.gst_on_gold_percent == null || data.gst_on_making_percent == null) {
        return null
      }
      cached = {
        gst_on_gold_percent: String(data.gst_on_gold_percent),
        gst_on_making_percent: String(data.gst_on_making_percent),
      }
      return cached
    } finally {
      inflight = null
    }
  })()

  return inflight
}
