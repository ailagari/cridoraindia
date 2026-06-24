import { apiFetch } from '@/lib/api'

export type PlatformPublicConfig = {
  customer_kyc_required: boolean
  google_auth_configured: boolean
}

let cached: PlatformPublicConfig | null = null
let inflight: Promise<PlatformPublicConfig | null> | null = null

const DEFAULT_CONFIG: PlatformPublicConfig = {
  customer_kyc_required: false,
  google_auth_configured: false,
}

export function getCachedPlatformPublicConfig(): PlatformPublicConfig {
  return cached ?? DEFAULT_CONFIG
}

export async function fetchPlatformPublicConfig(force = false): Promise<PlatformPublicConfig | null> {
  if (cached && !force) return cached
  if (inflight && !force) return inflight

  inflight = (async () => {
    const res = await apiFetch('/api/v1/platform/public-config/', { cache: 'no-store' })
    const data = (await res.json().catch(() => ({}))) as Partial<PlatformPublicConfig>
    if (!res.ok) return null
    cached = {
      customer_kyc_required: data.customer_kyc_required === true,
      google_auth_configured: data.google_auth_configured === true,
    }
    return cached
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

/** Bootstrap early so sync route helpers see KYC flag. */
void fetchPlatformPublicConfig()
