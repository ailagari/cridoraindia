import type { CatalogMetalPurityDTO, SpotPricesPayload } from '@/lib/marketplaceApi'

const SLUG_SPOT: Record<string, { family: 'gold' | 'silver'; key: string }> = {
  bis916: { family: 'gold', key: '22K' },
  '916': { family: 'gold', key: '22K' },
  '22k': { family: 'gold', key: '22K' },
  bis875: { family: 'gold', key: '21K' },
  bis750: { family: 'gold', key: '18K' },
  bis999: { family: 'gold', key: '24K' },
  '24k': { family: 'gold', key: '24K' },
  '999': { family: 'gold', key: '24K' },
  silver999: { family: 'silver', key: '999' },
  silver925: { family: 'silver', key: '925' },
}

export function spotRefForPurity(purity: CatalogMetalPurityDTO): { family: 'gold' | 'silver'; key: string } {
  if (purity.spot_family && purity.spot_key) {
    const family = purity.spot_family === 'silver' ? 'silver' : 'gold'
    return { family, key: purity.spot_key }
  }
  const fromSlug = SLUG_SPOT[purity.slug.toLowerCase()] ?? SLUG_SPOT[purity.slug]
  if (fromSlug) return fromSlug
  return { family: 'gold', key: '22K' }
}

export function liveInrPerGramForPurity(
  purity: CatalogMetalPurityDTO,
  spot: SpotPricesPayload | null,
): number | null {
  if (!spot) return null
  const { family, key } = spotRefForPurity(purity)
  const ladder = family === 'silver' ? spot.silver : spot.gold
  if (!ladder) return null
  const v = ladder[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Prefer BIS 916 / 22K row for SKU defaults. */
export function default916PurityId(purities: CatalogMetalPurityDTO[]): number | null {
  const preferSlugs = ['bis916', '916', '22k']
  for (const s of preferSlugs) {
    const row = purities.find((p) => p.slug.toLowerCase() === s)
    if (row) return row.id
  }
  const k22 = purities.find((p) => spotRefForPurity(p).key === '22K')
  return k22?.id ?? purities[0]?.id ?? null
}

export function formatInrPerGram(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
