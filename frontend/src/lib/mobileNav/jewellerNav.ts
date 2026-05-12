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
    items: [
      { sectionKey: 'cust_all', label: 'Customer management' },
      { sectionKey: 'cust_kyc', label: 'KYC pending' },
      { sectionKey: 'cust_value', label: 'High value' },
      { sectionKey: 'cust_locked', label: 'Lock-in exposure' },
    ],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    shortLabel: 'Market',
    icon: 'shop',
    items: [
      { sectionKey: 'mkt_products', label: 'Product listings' },
      { sectionKey: 'mkt_schemes', label: 'GoldNest' },
      { sectionKey: 'mkt_rates', label: 'Live gold & sellback' },
      { sectionKey: 'mkt_rules', label: 'Lock-in & redemption' },
    ],
  },
  {
    id: 'transactions',
    label: 'Operations',
    shortLabel: 'Ops',
    icon: 'coins',
    items: [
      { sectionKey: 'txn_purchases', label: 'Purchases' },
      { sectionKey: 'txn_sellback', label: 'Sellback' },
      { sectionKey: 'txn_redemptions', label: 'Redemption queue' },
      { sectionKey: 'txn_loans', label: 'Loan configuration' },
      { sectionKey: 'txn_transfers', label: 'Transfers' },
      { sectionKey: 'txn_settlements', label: 'Ledger & settlement' },
    ],
  },
  {
    id: 'profile',
    label: 'Profile',
    shortLabel: 'Profile',
    icon: 'profile',
    items: [
      { sectionKey: 'prof_kyb', label: 'KYB & verification' },
      { sectionKey: 'prof_payouts', label: 'Payouts' },
      { sectionKey: 'prof_shop', label: 'Showroom & credibility' },
    ],
  },
]

export const JEWELLER_DEFAULT_SECTION = 'desk_overview'

export const JEWELLER_LEGACY_SECTION: Record<string, string> = {
  overview: 'desk_overview',
  portfolio: 'desk_portfolio',
  kyb: 'prof_kyb',
  catalog: 'mkt_products',
  payments: 'prof_payouts',
  mkt_offers: 'mkt_rates',
}

export function normalizeJewellerSection(raw: string | null): string | null {
  if (!raw) return null
  if (JEWELLER_LEGACY_SECTION[raw]) return JEWELLER_LEGACY_SECTION[raw]
  const valid = JEWELLER_NAV_GROUPS.flatMap((g) => g.items).some((i) => i.sectionKey === raw)
  return valid ? raw : null
}
