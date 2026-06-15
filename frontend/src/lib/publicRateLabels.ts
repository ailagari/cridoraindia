/** User-facing rate source labels — never expose third-party feed names. */

const CRIDORA_LIVE = 'Cridora live rate'
const CRIDORA_MANUAL = 'Cridora manual rate'
const KERALA_GOLD = 'Kerala gold rate'

const LIVE_SOURCES = new Set([
  'akgsma_kerala',
  'kerala_gold_rate',
  'kerala_gold_rate_stale',
  'kerala_board',
  'goodreturns_kerala',
  'db_snapshot',
  'platform_floor',
  'admin_fallback',
  'live_spot',
  'stale_spot_cache',
  'spot',
  'cridora_live_rate',
])

export function publicRateSourceLabel(source?: string | null, sourceLabel?: string | null): string {
  if (sourceLabel && sourceLabel.trim()) return sourceLabel.trim()
  const src = (source ?? '').trim().toLowerCase()
  if (src === 'manual_ticker') return CRIDORA_MANUAL
  if (!src || LIVE_SOURCES.has(src)) return CRIDORA_LIVE
  return CRIDORA_LIVE
}

export function publicRateBasisLabel(source?: string | null): string {
  const src = (source ?? '').trim().toLowerCase()
  if (src === 'manual_ticker') return CRIDORA_MANUAL
  if (src === 'kerala_gold_rate_stale') return `${CRIDORA_LIVE} (cached)`
  return KERALA_GOLD
}
