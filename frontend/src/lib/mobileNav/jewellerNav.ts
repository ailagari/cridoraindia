import type { DashboardNavGroup } from './types'

export const JEWELLER_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: 'dashboard',
    label: 'Desk',
    shortLabel: 'Desk',
    icon: 'home',
    items: [
      { sectionKey: 'desk_overview', label: 'Overview' },
      { sectionKey: 'desk_portfolio', label: 'Portfolio' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    shortLabel: 'Clients',
    icon: 'users',
    items: [{ sectionKey: 'cust_hub', label: 'Customer vaults' }],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    shortLabel: 'Market',
    icon: 'shop',
    items: [
      { sectionKey: 'mkt_products', label: 'Listings' },
      { sectionKey: 'mkt_policy', label: 'Rates & schemes' },
    ],
  },
  {
    id: 'transactions',
    label: 'Operations',
    shortLabel: 'Ops',
    icon: 'coins',
    items: [
      { sectionKey: 'txn_purchases', label: 'Purchases' },
      { sectionKey: 'txn_ops', label: 'Redemptions' },
      { sectionKey: 'txn_transfers', label: 'Transfers' },
    ],
  },
  {
    id: 'profile',
    label: 'Profile',
    shortLabel: 'Profile',
    icon: 'profile',
    items: [
      { sectionKey: 'prof_kyb', label: 'KYB' },
      { sectionKey: 'prof_more', label: 'Business' },
    ],
  },
]

export const JEWELLER_DEFAULT_SECTION = 'desk_overview'

export const JEWELLER_LEGACY_SECTION: Record<string, string> = {
  overview: 'desk_overview',
  portfolio: 'desk_portfolio',
  kyb: 'prof_kyb',
  catalog: 'mkt_products',
  payments: 'prof_more',
  mkt_offers: 'mkt_policy',
  cust_all: 'cust_hub',
  cust_kyc: 'cust_hub',
  cust_value: 'cust_hub',
  cust_locked: 'cust_hub',
  mkt_schemes: 'mkt_policy',
  mkt_rates: 'mkt_policy',
  mkt_rules: 'mkt_policy',
  txn_sellback: 'txn_ops',
  txn_redemptions: 'txn_ops',
  txn_loans: 'txn_ops',
  txn_settlements: 'txn_ops',
  prof_payouts: 'prof_more',
  prof_shop: 'prof_more',
}

export function normalizeJewellerSection(raw: string | null): string | null {
  if (!raw) return null
  if (JEWELLER_LEGACY_SECTION[raw]) return JEWELLER_LEGACY_SECTION[raw]
  const valid = JEWELLER_NAV_GROUPS.flatMap((g) => g.items).some((i) => i.sectionKey === raw)
  return valid ? raw : null
}
