import type { DashboardNavGroup } from './types'

export const ADMIN_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Home',
    icon: 'home',
    items: [
      { sectionKey: 'ops_overview', label: 'Network pulse' },
      { sectionKey: 'ops_portfolio', label: 'Platform portfolio' },
    ],
  },
  {
    id: 'kyc',
    label: 'Approvals',
    shortLabel: 'KYC',
    icon: 'shield',
    items: [
      { sectionKey: 'ap_kyc', label: 'KYC (customers)' },
      { sectionKey: 'ap_kyb', label: 'Jeweller verification' },
    ],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    shortLabel: 'Market',
    icon: 'globe',
    items: [
      { sectionKey: 'mkt_products', label: 'Product approval' },
      { sectionKey: 'mkt_schemes', label: 'GoldNest schemes' },
      { sectionKey: 'mkt_offers', label: 'Marketplace moderation' },
      { sectionKey: 'mkt_reports', label: 'Risk monitoring' },
    ],
  },
  {
    id: 'settlements',
    label: 'Settlements',
    shortLabel: 'Money',
    icon: 'coins',
    items: [
      { sectionKey: 'fin_payments', label: 'Settlement monitoring' },
      { sectionKey: 'fin_ledger', label: 'Ledger & reconciliation' },
    ],
  },
  {
    id: 'settings',
    label: 'Control',
    shortLabel: 'Admin',
    icon: 'building',
    items: [
      { sectionKey: 'people_users', label: 'Users' },
      { sectionKey: 'plat_gold', label: 'Gold ticker' },
      { sectionKey: 'plat_emergency', label: 'Emergency funds' },
      { sectionKey: 'plat_settings', label: 'Settings' },
    ],
  },
]

export const ADMIN_DEFAULT_SECTION = 'ops_overview'

export const ADMIN_LEGACY_SECTION: Record<string, string> = {
  overview: 'ops_overview',
  portfolio: 'ops_portfolio',
  kyc: 'ap_kyc',
  kyb: 'ap_kyb',
  users: 'people_users',
  payments: 'fin_payments',
  ledger: 'fin_ledger',
}

export function normalizeAdminSection(raw: string | null): string | null {
  if (!raw) return null
  if (ADMIN_LEGACY_SECTION[raw]) return ADMIN_LEGACY_SECTION[raw]
  const valid = ADMIN_NAV_GROUPS.flatMap((g) => g.items).some((i) => i.sectionKey === raw)
  return valid ? raw : null
}
