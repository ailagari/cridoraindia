import type { AuthUser } from '@/context/AuthContext'
import { CUSTOMER_DEFAULT_SECTION } from '@/lib/mobileNav/customerNav'
import { JEWELLER_DEFAULT_SECTION } from '@/lib/mobileNav/jewellerNav'
import { getCachedPlatformPublicConfig } from '@/lib/platformPublicConfig'

/** In-app dashboards (SPA); marketing site uses PublicLayout. */
export function isDashboardPath(pathname: string): boolean {
  return pathname.startsWith('/dashboard/') || pathname.startsWith('/userdashboard')
}

export function userDashboardPath(user: AuthUser): string {
  switch (user.user_type) {
    case 'customer':
      return '/userdashboard'
    case 'jeweller':
      return '/dashboard/jeweller'
    case 'admin':
      return '/dashboard/admin'
    default:
      return '/'
  }
}

function customerNeedsKyc(user: AuthUser): boolean {
  const required = getCachedPlatformPublicConfig().customer_kyc_required
  return required && user.kyc_status !== 'verified'
}

/** First-time customer landing: personal gold tracking with bill scan open. */
export function customerOnboardingLandingPath(): string {
  return '/userdashboard?section=portfolio_overview&portfolio_action=scan'
}

function dashboardPortfolioSection(user: AuthUser): string | null {
  if (user.user_type === 'customer') {
    if (customerNeedsKyc(user)) return 'profile_kyc'
    return CUSTOMER_DEFAULT_SECTION
  }
  if (user.user_type === 'jeweller') {
    if (user.kyc_status !== 'verified') return 'prof_kyb'
    return JEWELLER_DEFAULT_SECTION
  }
  return null
}

/** After login, app open, or “open dashboard”: portfolio (or KYC/KYB when pending). */
export function dashboardLandingPath(user: AuthUser): string {
  const base = userDashboardPath(user)
  const section = dashboardPortfolioSection(user)
  if (!section) return base
  const isDefaultPortfolio =
    (user.user_type === 'customer' && section === CUSTOMER_DEFAULT_SECTION) ||
    (user.user_type === 'jeweller' && section === JEWELLER_DEFAULT_SECTION)
  if (isDefaultPortfolio && user.user_type === 'customer') {
    return base
  }
  return `${base}?section=${section}`
}

/** Post sign-up / Google auth — complete profile first, then scan onboarding. */
export function postAuthLandingPath(user: AuthUser, opts?: { onboarding?: boolean }): string {
  if (
    user.user_type === 'customer' &&
    user.auth_provider === 'google' &&
    user.profile_complete === false
  ) {
    return '/complete-profile'
  }
  if (opts?.onboarding && user.user_type === 'customer' && !customerNeedsKyc(user)) {
    return customerOnboardingLandingPath()
  }
  return dashboardLandingPath(user)
}

/** Public bottom nav “Account” tab — profile/settings hub, distinct from main Dashboard landing. */
export function dashboardAccountShortcutPath(user: AuthUser): string {
  const base = userDashboardPath(user)
  const section =
    user.user_type === 'customer'
      ? 'profile_personal'
      : user.user_type === 'jeweller'
        ? 'prof_more'
        : user.user_type === 'admin'
          ? 'plat_account'
          : 'profile_personal'
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}section=${section}`
}

/** Whether `section` query on a dashboard is the Account shortcut (for nav highlighting). */
export function isAccountShortcutSection(user: AuthUser | null, sectionParam: string | null): boolean {
  if (!user) return false
  const s = sectionParam ?? ''
  switch (user.user_type) {
    case 'customer':
      return s === 'profile_personal' || s === 'profile_security' || s === 'profile_cridora_id'
    case 'jeweller':
      return s === 'prof_more' || s === 'prof_security'
    case 'admin':
      return s === 'plat_account' || s === 'plat_security' || s === 'plat_gold' || s === 'plat_control'
    default:
      return false
  }
}
