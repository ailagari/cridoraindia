import type { AuthUser } from '@/context/AuthContext'

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

/** After login or “open dashboard”: surface KYC/KYB until the account is verified. */
export function dashboardLandingPath(user: AuthUser): string {
  const base = userDashboardPath(user)
  if (user.user_type === 'customer' && user.kyc_status !== 'verified') {
    return `${base}?section=profile_kyc`
  }
  if (user.user_type === 'jeweller' && user.kyc_status !== 'verified') {
    return `${base}?section=prof_kyb`
  }
  return base
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
      return s === 'prof_more'
    case 'admin':
      return s === 'plat_account' || s === 'plat_security' || s === 'plat_gold' || s === 'plat_control'
    default:
      return false
  }
}
