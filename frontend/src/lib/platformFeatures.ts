import { authFetch } from '@/lib/api'
import type { DashboardNavGroup } from '@/lib/mobileNav/types'

export type PlatformFeaturesPayload = {
  flags: Record<string, boolean>
  customer_sections: Record<string, boolean>
  jeweller_sections: Record<string, boolean>
}

export type FeatureCatalogItem = {
  key: string
  label: string
  description: string
  default: boolean
  enabled: boolean
}

let cached: PlatformFeaturesPayload | null = null

export async function fetchPlatformFeatures(force = false): Promise<PlatformFeaturesPayload | null> {
  if (cached && !force) return cached
  const res = await authFetch('/api/v1/platform/features/')
  const data = (await res.json().catch(() => ({}))) as PlatformFeaturesPayload & { detail?: string }
  if (!res.ok || !data.flags) return null
  cached = {
    flags: data.flags,
    customer_sections: data.customer_sections ?? {},
    jeweller_sections: data.jeweller_sections ?? {},
  }
  return cached
}

export function clearPlatformFeaturesCache(): void {
  cached = null
}

/** Mirrors backend defaults until /platform/features/ loads. */
const DEFAULT_FLAGS: Record<string, boolean> = {
  golden_scheme: false,
  sellback_upi: false,
}

export function isFeatureEnabled(flags: Record<string, boolean> | null | undefined, key: string): boolean {
  if (flags && key in flags) return flags[key] === true
  return DEFAULT_FLAGS[key] ?? true
}

export function filterCustomerNav(
  groups: DashboardNavGroup[],
  sections: Record<string, boolean> | undefined,
): DashboardNavGroup[] {
  if (!sections) return groups
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => sections[i.sectionKey] !== false),
    }))
    .filter((g) => g.items.length > 0)
}

export function filterJewellerNav(
  groups: DashboardNavGroup[],
  sections: Record<string, boolean> | undefined,
): DashboardNavGroup[] {
  if (!sections) return groups
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => sections[i.sectionKey] !== false),
    }))
    .filter((g) => g.items.length > 0)
}

export async function fetchAdminFeatureRollout(): Promise<{
  catalog: FeatureCatalogItem[]
  flags: Record<string, boolean>
} | null> {
  const res = await authFetch('/api/v1/admin/feature-rollout/')
  const data = (await res.json().catch(() => ({}))) as {
    catalog?: FeatureCatalogItem[]
    flags?: Record<string, boolean>
    detail?: string
  }
  if (!res.ok || !data.catalog || !data.flags) return null
  return { catalog: data.catalog, flags: data.flags }
}

export async function patchAdminFeatureRollout(
  flags: Record<string, boolean>,
): Promise<{ catalog: FeatureCatalogItem[]; flags: Record<string, boolean> } | null> {
  const res = await authFetch('/api/v1/admin/feature-rollout/', {
    method: 'PATCH',
    jsonBody: { flags },
  })
  const data = (await res.json().catch(() => ({}))) as {
    catalog?: FeatureCatalogItem[]
    flags?: Record<string, boolean>
    detail?: string
  }
  if (!res.ok || !data.catalog || !data.flags) return null
  clearPlatformFeaturesCache()
  return { catalog: data.catalog, flags: data.flags }
}
