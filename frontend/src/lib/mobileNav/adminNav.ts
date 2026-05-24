import type { DashboardNavGroup } from './types'

export const ADMIN_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: 'users',
    label: 'Users',
    shortLabel: 'Users',
    icon: 'users',
    items: [
      { sectionKey: 'users_jewellers', label: 'Jewellers' },
      { sectionKey: 'users_customers', label: 'Customers' },
      { sectionKey: 'users_kyc_kyb', label: 'KYC / KYB' },
    ],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    shortLabel: 'Market',
    icon: 'globe',
    items: [
      { sectionKey: 'mkt_products', label: 'Catalogue' },
      { sectionKey: 'mkt_programs', label: 'Programs & risks' },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    shortLabel: 'Portfolio',
    icon: 'portfolio',
    items: [
      { sectionKey: 'ops_overview', label: 'Pulse' },
      { sectionKey: 'ops_portfolio', label: 'Holding' },
      { sectionKey: 'ops_personal_vault', label: 'Gold vault' },
    ],
  },
  {
    id: 'treasury',
    label: 'Treasury',
    shortLabel: 'Treasury',
    icon: 'coins',
    items: [
      { sectionKey: 'fin_hub', label: 'Ledger' },
      { sectionKey: 'fin_settlement', label: 'Settlement' },
      { sectionKey: 'fin_payments', label: 'Payments' },
      { sectionKey: 'fin_fraud_reports', label: 'Fraud reports' },
    ],
  },
  {
    id: 'control',
    label: 'Control',
    shortLabel: 'Control',
    icon: 'building',
    items: [
      { sectionKey: 'plat_festival', label: 'Pushes & alerts' },
      { sectionKey: 'plat_gold', label: 'Ticker & fees' },
      { sectionKey: 'plat_control', label: 'Fractional policy' },
      { sectionKey: 'plat_features', label: 'Feature rollout' },
      { sectionKey: 'plat_security', label: 'Password & security' },
      { sectionKey: 'plat_account', label: 'Account settings' },
    ],
  },
]

export const ADMIN_DEFAULT_SECTION = 'ops_overview'

export const ADMIN_LEGACY_SECTION: Record<string, string> = {
  overview: 'ops_overview',
  portfolio: 'ops_portfolio',
  kyc: 'users_kyc_kyb',
  kyb: 'users_kyc_kyb',
  ap_kyc: 'users_kyc_kyb',
  ap_kyb: 'users_kyc_kyb',
  users: 'users_customers',
  people_users: 'users_customers',
  payments: 'fin_hub',
  ledger: 'fin_hub',
  mkt_schemes: 'mkt_programs',
  mkt_offers: 'mkt_programs',
  mkt_reports: 'mkt_programs',
  plat_emergency: 'plat_control',
  plat_settings: 'plat_account',
  settings: 'plat_account',
}

export function normalizeAdminSection(raw: string | null): string | null {
  if (!raw) return null
  if (ADMIN_LEGACY_SECTION[raw]) return ADMIN_LEGACY_SECTION[raw]
  const valid = ADMIN_NAV_GROUPS.flatMap((g) => g.items).some((i) => i.sectionKey === raw)
  return valid ? raw : null
}
