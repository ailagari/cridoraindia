import type { DashboardNavGroup } from './types'

/** Flatten for validation / desktop sidebar. */
export const CUSTOMER_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: 'shop',
    label: 'Market',
    shortLabel: 'Market',
    icon: 'shop',
    items: [
      { sectionKey: 'shop_jewellers', label: 'Search jeweller' },
      { sectionKey: 'shop_products', label: 'Products' },
    ],
  },
  {
    id: 'invest',
    label: 'Invest',
    shortLabel: 'Invest',
    icon: 'coins',
    items: [
      { sectionKey: 'invest_fractional', label: 'Fractional' },
      { sectionKey: 'invest_deposit', label: 'Deposit' },
      { sectionKey: 'invest_scheme', label: 'Scheme' },
      { sectionKey: 'invest_cridorapay', label: 'CridoraPay' },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    shortLabel: 'Portfolio',
    icon: 'portfolio',
    items: [
      { sectionKey: 'portfolio_overview', label: 'Overview' },
      { sectionKey: 'portfolio_personal', label: 'My gold' },
      { sectionKey: 'portfolio_holdings', label: 'Vault' },
      { sectionKey: 'portfolio_vault_ids', label: 'Vault ID' },
    ],
  },
  {
    id: 'redeem',
    label: 'Redeem',
    shortLabel: 'Redeem',
    icon: 'redeem',
    items: [
      { sectionKey: 'redeem_cash', label: 'Cash sell' },
      { sectionKey: 'redeem_transfer', label: 'Transfer' },
      { sectionKey: 'redeem_loan', label: 'Loan' },
      { sectionKey: 'redeem_emergency', label: 'Emergency' },
    ],
  },
  {
    id: 'profile',
    label: 'Profile',
    shortLabel: 'Profile',
    icon: 'profile',
    items: [
      { sectionKey: 'profile_cridora_id', label: 'Cridora ID' },
      { sectionKey: 'profile_qr', label: 'QR code' },
      { sectionKey: 'profile_security', label: 'Password & security' },
      { sectionKey: 'profile_personal', label: 'Personal details' },
      { sectionKey: 'profile_notifications', label: 'Notifications' },
      { sectionKey: 'profile_kyc', label: 'KYC' },
    ],
  },
]

export const CUSTOMER_DEFAULT_SECTION = 'portfolio_overview'

export const CUSTOMER_LEGACY_SECTION: Record<string, string> = {
  overview: 'portfolio_overview',
  kyc: 'profile_kyc',
  portfolio: 'portfolio_overview',
  payments: 'profile_personal',
  shop_offers: 'shop_products',
  shop_schemes: 'invest_scheme',
  shop_cridorapay: 'invest_cridorapay',
  invest_deposit: 'invest_deposit',
  invest_goldnest: 'invest_fractional',
  invest_history: 'invest_fractional',
  portfolio_pnl: 'portfolio_holdings',
  portfolio_locked: 'portfolio_holdings',
  portfolio_activity: 'portfolio_holdings',
  portfolio_vaults: 'portfolio_vault_ids',
  redeem_vault_shop: 'redeem_cash',
  redeem_hub: 'redeem_cash',
  redeem_cash_sell: 'redeem_cash',
  profile_account: 'profile_personal',
  profile_notifications: 'profile_notifications',
  profile_payments: 'profile_personal',
  profile_settings: 'profile_security',
  profile_more: 'profile_personal',
}

export function normalizeCustomerSection(raw: string | null): string | null {
  if (!raw) return null
  if (CUSTOMER_LEGACY_SECTION[raw]) return CUSTOMER_LEGACY_SECTION[raw]
  const valid = CUSTOMER_NAV_GROUPS.flatMap((g) => g.items).some((i) => i.sectionKey === raw)
  return valid ? raw : null
}
