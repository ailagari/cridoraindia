import type { DashboardNavGroup } from './types'

export const JEWELLER_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: 'customers',
    label: 'Customer',
    shortLabel: 'Customer',
    icon: 'users',
    items: [{ sectionKey: 'cust_hub', label: 'Customer vaults' }],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    shortLabel: 'Market',
    icon: 'shop',
    items: [
      { sectionKey: 'mkt_products', label: 'Catalogue SKU' },
      { sectionKey: 'mkt_policy', label: 'Rates & schemes' },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    shortLabel: 'Portfolio',
    icon: 'portfolio',
    items: [{ sectionKey: 'portfolio', label: 'Portfolio' }],
  },
  {
    id: 'transactions',
    label: 'Operations',
    shortLabel: 'Ops',
    icon: 'coins',
    items: [
      { sectionKey: 'txn_purchases', label: 'Purchase' },
      { sectionKey: 'txn_deposits', label: 'Deposit' },
      { sectionKey: 'txn_ops', label: 'Redemption' },
      { sectionKey: 'txn_loans', label: 'Loans' },
      { sectionKey: 'txn_transfers', label: 'Transfer' },
    ],
  },
  {
    id: 'profile',
    label: 'Profile',
    shortLabel: 'Profile',
    icon: 'profile',
    items: [
      { sectionKey: 'prof_more', label: 'Shop & business' },
      { sectionKey: 'prof_security', label: 'Password & security' },
      { sectionKey: 'prof_kyb', label: 'KYB' },
    ],
  },
]

export const JEWELLER_DEFAULT_SECTION = 'portfolio'

export const JEWELLER_LEGACY_SECTION: Record<string, string> = {
  overview: 'portfolio',
  desk_overview: 'portfolio',
  portfolio_home: 'portfolio',
  desk_portfolio: 'portfolio',
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
  txn_gold_deposit: 'txn_deposits',
  txn_loans: 'txn_loans',
  txn_settlements: 'txn_ops',
  prof_payouts: 'prof_more',
  prof_shop: 'prof_more',
  profile_security: 'prof_security',
}

export function normalizeJewellerSection(raw: string | null): string | null {
  if (!raw) return null
  if (JEWELLER_LEGACY_SECTION[raw]) return JEWELLER_LEGACY_SECTION[raw]
  const valid = JEWELLER_NAV_GROUPS.flatMap((g) => g.items).some((i) => i.sectionKey === raw)
  return valid ? raw : null
}
