import type { DashboardNavGroup } from './types'

/** Flatten for validation / desktop sidebar. */
export const CUSTOMER_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: 'shop',
    label: 'Marketplace',
    shortLabel: 'Market',
    icon: 'shop',
    items: [
      { sectionKey: 'shop_jewellers', label: 'Jeweller network' },
      { sectionKey: 'shop_products', label: 'Product catalogue' },
      { sectionKey: 'shop_schemes', label: 'GoldNest' },
    ],
  },
  {
    id: 'invest',
    label: 'Grow gold',
    shortLabel: 'Grow',
    icon: 'coins',
    items: [
      { sectionKey: 'invest_fractional', label: 'Fractional purchase' },
      { sectionKey: 'invest_deposit', label: 'Gold deposit' },
      { sectionKey: 'invest_goldnest', label: 'GoldNest' },
      { sectionKey: 'invest_history', label: 'History' },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    shortLabel: 'Portfolio',
    icon: 'portfolio',
    items: [
      { sectionKey: 'portfolio_overview', label: 'Overview' },
      { sectionKey: 'portfolio_holdings', label: 'Holdings & ledgers' },
      { sectionKey: 'portfolio_pnl', label: 'Profit / loss' },
      { sectionKey: 'portfolio_locked', label: 'Lock-in' },
      { sectionKey: 'portfolio_activity', label: 'Activity' },
    ],
  },
  {
    id: 'redeem',
    label: 'Use gold',
    shortLabel: 'Use',
    icon: 'grid',
    items: [
      { sectionKey: 'redeem_ornament', label: 'Ornament redemption' },
      { sectionKey: 'redeem_cash', label: 'Cash sellback' },
      { sectionKey: 'redeem_loan', label: 'Gold loan' },
      { sectionKey: 'redeem_transfer', label: 'Transfer' },
      { sectionKey: 'redeem_emergency', label: 'Emergency funds' },
    ],
  },
  {
    id: 'profile',
    label: 'Profile',
    shortLabel: 'Profile',
    icon: 'profile',
    items: [
      { sectionKey: 'profile_account', label: 'Account' },
      { sectionKey: 'profile_kyc', label: 'KYC' },
      { sectionKey: 'profile_security', label: 'Security' },
      { sectionKey: 'profile_notifications', label: 'Alerts' },
      { sectionKey: 'profile_payments', label: 'Payments' },
      { sectionKey: 'profile_settings', label: 'Settings' },
    ],
  },
]

export const CUSTOMER_DEFAULT_SECTION = 'portfolio_overview'

export const CUSTOMER_LEGACY_SECTION: Record<string, string> = {
  overview: 'portfolio_overview',
  kyc: 'profile_kyc',
  portfolio: 'portfolio_overview',
  payments: 'profile_payments',
  shop_offers: 'shop_products',
}

export function normalizeCustomerSection(raw: string | null): string | null {
  if (!raw) return null
  if (CUSTOMER_LEGACY_SECTION[raw]) return CUSTOMER_LEGACY_SECTION[raw]
  const valid = CUSTOMER_NAV_GROUPS.flatMap((g) => g.items).some((i) => i.sectionKey === raw)
  return valid ? raw : null
}
