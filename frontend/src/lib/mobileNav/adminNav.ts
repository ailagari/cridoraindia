import type { DashboardNavGroup } from './types'

export const ADMIN_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Home',
    icon: 'home',
    items: [
      { sectionKey: 'ops_overview', label: 'Pulse' },
      { sectionKey: 'ops_portfolio', label: 'Holdings' },
      { sectionKey: 'ops_personal_vault', label: 'Gold vault' },
    ],
  },
  {
    id: 'kyc',
    label: 'Approvals',
    shortLabel: 'KYC',
    icon: 'shield',
    items: [
      { sectionKey: 'ap_kyc', label: 'Customers' },
      { sectionKey: 'ap_kyb', label: 'Jewellers' },
    ],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    shortLabel: 'Market',
    icon: 'globe',
    items: [
      { sectionKey: 'mkt_products', label: 'Catalogue' },
      { sectionKey: 'mkt_programs', label: 'Programs & risk' },
    ],
  },
  {
    id: 'settlements',
    label: 'Treasury',
    shortLabel: 'Money',
    icon: 'coins',
    items: [{ sectionKey: 'fin_hub', label: 'Settlements' }],
  },
  {
    id: 'settings',
    label: 'Control',
    shortLabel: 'Admin',
    icon: 'building',
    items: [
      { sectionKey: 'people_users', label: 'Users' },
      { sectionKey: 'plat_festival', label: 'Festival pushes' },
      { sectionKey: 'plat_gold', label: 'Ticker & fees' },
      { sectionKey: 'plat_control', label: 'Controls' },
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
  payments: 'fin_hub',
  ledger: 'fin_hub',
  mkt_schemes: 'mkt_programs',
  mkt_offers: 'mkt_programs',
  mkt_reports: 'mkt_programs',
  plat_emergency: 'plat_control',
  plat_settings: 'plat_control',
}

export function normalizeAdminSection(raw: string | null): string | null {
  if (!raw) return null
  if (ADMIN_LEGACY_SECTION[raw]) return ADMIN_LEGACY_SECTION[raw]
  const valid = ADMIN_NAV_GROUPS.flatMap((g) => g.items).some((i) => i.sectionKey === raw)
  return valid ? raw : null
}
