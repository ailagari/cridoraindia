import type { DashboardNavGroup } from './types'

/** Flatten for validation / desktop sidebar. */
export const CUSTOMER_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: 'shop',
    label: 'Marketplace',
    shortLabel: 'Market',
    icon: 'shop',
    items: [
      { sectionKey: 'shop_jewellers', label: 'Jewellers' },
      { sectionKey: 'shop_products', label: 'Catalogue' },
    ],
  },
  {
    id: 'invest',
    label: 'Invest',
    shortLabel: 'Invest',
    icon: 'coins',
    items: [
      { sectionKey: 'invest_fractional', label: 'Buy gold' },
      { sectionKey: 'invest_deposit', label: 'Gold deposit' },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    shortLabel: 'Portfolio',
    icon: 'portfolio',
    items: [
      { sectionKey: 'portfolio_overview', label: 'Overview' },
      { sectionKey: 'portfolio_holdings', label: 'Vaults' },
      { sectionKey: 'portfolio_vault_ids', label: 'Vault IDs' },
    ],
  },
  {
    id: 'redeem',
    label: 'Use gold',
    shortLabel: 'Use',
    icon: 'grid',
    items: [
      { sectionKey: 'redeem_vault_shop', label: 'Shop with vault' },
      { sectionKey: 'redeem_transfer', label: 'Transfer' },
      { sectionKey: 'redeem_hub', label: 'Redeem & liquidity' },
    ],
  },
  {
    id: 'profile',
    label: 'Profile',
    shortLabel: 'Profile',
    icon: 'profile',
    items: [
      { sectionKey: 'profile_kyc', label: 'KYC' },
      { sectionKey: 'profile_more', label: 'Account' },
    ],
  },
]

export const CUSTOMER_DEFAULT_SECTION = 'portfolio_overview'

export const CUSTOMER_LEGACY_SECTION: Record<string, string> = {
  overview: 'portfolio_overview',
  kyc: 'profile_kyc',
  portfolio: 'portfolio_overview',
  payments: 'profile_more',
  shop_offers: 'shop_products',
  shop_schemes: 'shop_products',
  invest_deposit: 'invest_deposit',
  invest_goldnest: 'invest_fractional',
  invest_history: 'invest_fractional',
  portfolio_pnl: 'portfolio_holdings',
  portfolio_locked: 'portfolio_holdings',
  portfolio_activity: 'portfolio_holdings',
  portfolio_vaults: 'portfolio_vault_ids',
  redeem_ornament: 'redeem_vault_shop',
  redeem_cash: 'redeem_hub',
  redeem_loan: 'redeem_hub',
  redeem_emergency: 'redeem_hub',
  profile_account: 'profile_more',
  profile_security: 'profile_more',
  profile_notifications: 'profile_more',
  profile_payments: 'profile_more',
  profile_settings: 'profile_more',
}

export function normalizeCustomerSection(raw: string | null): string | null {
  if (!raw) return null
  if (CUSTOMER_LEGACY_SECTION[raw]) return CUSTOMER_LEGACY_SECTION[raw]
  const valid = CUSTOMER_NAV_GROUPS.flatMap((g) => g.items).some((i) => i.sectionKey === raw)
  return valid ? raw : null
}
